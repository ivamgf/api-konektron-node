import { createHash } from 'node:crypto';
import express, { Router } from 'express';
import { db } from '#database/connection.js';
import { validate } from '#middlewares/validate.js';
import { idParams } from '#shared/schemas.js';
import { invalid } from '#shared/projectRefs.js';
import { AppError } from '#utils/AppError.js';

// Arquivos anexados a um registro (ontologia, diagrama BPMN...). O conteúdo fica numa tabela
// própria (bytea, apagada em cascata com o registro) e os metadados ficam no registro, em
// file_name, file_mime, file_size, file_sha256 e file_uploaded_at: as listagens não carregam bytes.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FILE_FIELDS = ['fileName', 'fileMime', 'fileSize', 'fileSha256', 'fileUploadedAt'];

const MIME = {
  owl: 'application/rdf+xml',
  rdf: 'application/rdf+xml',
  owx: 'application/owl+xml',
  ttl: 'text/turtle',
  nt: 'application/n-triples',
  nq: 'application/n-quads',
  n3: 'text/n3',
  trig: 'application/trig',
  jsonld: 'application/ld+json',
  json: 'application/json',
  xml: 'application/xml',
  bpmn: 'application/xml',
  html: 'text/html',
  obo: 'text/plain',
  ofn: 'text/plain',
  omn: 'text/plain',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export const extensionOf = (name) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';

// O nome vem no cabeçalho X-File-Name (codificado com encodeURIComponent); fica só o nome, sem caminho
export function readFileName(req) {
  let raw = req.get('x-file-name') ?? '';
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // nome sem codificação: usa como veio
  }
  const name = [...(raw.split(/[\\/]/).pop() ?? '')].filter((c) => c >= ' ' && c !== '"').join('');
  return name.trim().slice(0, 255);
}

const disposition = (name) => {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};

/**
 * Rotas PUT/GET/DELETE /:id/file para um recurso do crudRouter (monte antes do CRUD).
 *
 * @param {object}   o
 * @param {string}   o.table       tabela do registro (com as colunas file_*)
 * @param {string}   o.blobTable   tabela com o conteúdo (chave = foreignKey)
 * @param {string}   o.foreignKey  coluna da blobTable que aponta para o registro (camelCase)
 * @param {Function} o.scope       (req) => where do escopo (ex.: { projectId })
 * @param {string[]} o.extensions  extensões aceitas, sem ponto
 * @param {Function}[o.onUpload]   async (buffer, { name, ext, row }) => { update?, analysis? }
 * @param {object}  [o.onRemove]   colunas a limpar junto com o arquivo (ex.: { analysis: null })
 * @param {string}  [o.label]      nome para mensagens de erro
 */
export function fileRoutes({ table, blobTable, foreignKey, scope, extensions, onUpload, onRemove = {}, label = 'Registro', maxBytes = MAX_FILE_BYTES }) {
  const router = Router({ mergeParams: true });
  const find = (q, req, columns = '*') => q(table).where(scope(req)).where({ id: req.validated.params.id }).first(columns);

  router.put(
    '/:id/file',
    validate({ params: idParams }),
    express.raw({ type: () => true, limit: maxBytes }),
    async (req, res) => {
      const name = readFileName(req);
      if (!name) throw invalid('file', 'Informe o nome do arquivo no cabeçalho X-File-Name');
      const ext = extensionOf(name);
      if (!extensions.includes(ext)) {
        throw invalid('file', `Extensão não aceita. Use: ${extensions.map((e) => `.${e}`).join(', ')}`);
      }
      // um corpo JSON é lido antes pelo express.json: o arquivo deve vir como application/octet-stream
      if (!Buffer.isBuffer(req.body)) throw new AppError('Envie o arquivo como application/octet-stream', 415);
      if (!req.body.length) throw invalid('file', 'Arquivo vazio');

      const row = await find(db, req);
      if (!row) throw AppError.notFound(label);
      const { update = {}, analysis = null } = (await onUpload?.(req.body, { name, ext, row })) ?? {};
      const meta = {
        fileName: name,
        fileMime: MIME[ext] ?? 'application/octet-stream',
        fileSize: req.body.length,
        fileSha256: createHash('sha256').update(req.body).digest('hex'),
        fileUploadedAt: db.fn.now(),
      };
      const updated = await db.transaction(async (trx) => {
        await trx(blobTable).insert({ [foreignKey]: row.id, data: req.body }).onConflict(foreignKey).merge();
        const [u] = await trx(table).where({ id: row.id }).update({ ...update, ...meta }).returning('*');
        return u;
      });
      res.json({ ...updated, analysis });
    },
  );

  router.get('/:id/file', validate({ params: idParams }), async (req, res) => {
    const row = await find(db, req, ['id', 'fileName', 'fileMime']);
    if (!row) throw AppError.notFound(label);
    const blob = row.fileName && (await db(blobTable).where({ [foreignKey]: row.id }).first('data'));
    if (!blob) throw AppError.notFound('Arquivo');
    res.set({
      'Content-Type': row.fileMime ?? 'application/octet-stream',
      'Content-Disposition': disposition(row.fileName),
      'Cache-Control': 'private, no-store',
    });
    res.send(blob.data);
  });

  router.delete('/:id/file', validate({ params: idParams }), async (req, res) => {
    const row = await find(db, req, ['id']);
    if (!row) throw AppError.notFound(label);
    await db.transaction(async (trx) => {
      await trx(blobTable).where({ [foreignKey]: row.id }).del();
      await trx(table).where({ id: row.id }).update({
        ...Object.fromEntries(FILE_FIELDS.map((f) => [f, null])),
        ...onRemove,
      });
    });
    res.status(204).end();
  });

  return router;
}
