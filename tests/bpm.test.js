import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, IMPLEMENTED_SECTIONS, SECTIONS } from '#config/plans.js';
import { analyzeBpmn } from '#modules/bpm/bpmn.analyzer.js';
import { diagramSchema, processSchema } from '#modules/bpm/bpm.schemas.js';
import { bpmService } from '#modules/bpm/bpm.service.js';
import { buildOpenApi } from '../src/docs/openapi.js';

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="d">
  <bpmn:collaboration id="c"><bpmn:participant id="p1" name="Clínica" processRef="proc"/></bpmn:collaboration>
  <bpmn:process id="proc" name="Agendar atendimento" isExecutable="false">
    <bpmn:laneSet><bpmn:lane id="l1" name="Recepção"/><bpmn:lane id="l2" name="Sistema"/></bpmn:laneSet>
    <bpmn:startEvent id="s"/>
    <bpmn:userTask id="t1" name="Escolher horário &amp; serviço"/>
    <bpmn:serviceTask id="t2" name="Reservar horário"/>
    <bpmn:task id="t3" name="Avisar cliente"/>
    <bpmn:exclusiveGateway id="g1"/>
    <bpmn:endEvent id="e"/>
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="t1" targetRef="t2"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="di"/>
</bpmn:definitions>`;

test('BPM: implementado, planos Standard e Master', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.BPM));
  assert.ok(canAccessSection({ role: 'client', plan: 'standard' }, SECTIONS.BPM));
  assert.ok(!canAccessSection({ role: 'client', plan: 'free' }, SECTIONS.BPM));
});

test('leitura do BPMN: contagens, tipos e nomes', () => {
  const m = analyzeBpmn(Buffer.from(BPMN));
  assert.equal(m.isBpmn, true);
  assert.equal(m.counts.tasks, 3);
  assert.deepEqual(m.byType.tasks, { task: 1, userTask: 1, serviceTask: 1 });
  assert.equal(m.counts.startEvents, 1);
  assert.equal(m.counts.endEvents, 1);
  assert.equal(m.counts.gateways, 1);
  assert.equal(m.counts.sequenceFlows, 2);
  assert.equal(m.counts.participants, 1);
  assert.equal(m.counts.lanes, 2);
  assert.deepEqual(m.processes, ['Agendar atendimento']);
  assert.deepEqual(m.lanes, ['Recepção', 'Sistema']);
  assert.ok(m.taskNames.includes('Escolher horário & serviço'));
  assert.equal(m.hasLayout, true);
});

test('leitura do BPMN: qualquer prefixo e XML que não é BPMN', () => {
  const plain = BPMN.replaceAll('bpmn:', 'semantic:').replace('xmlns:semantic', 'xmlns:semantic');
  assert.equal(analyzeBpmn(Buffer.from(plain)).counts.tasks, 3);
  assert.deepEqual(analyzeBpmn(Buffer.from('<root><task/></root>')), { isBpmn: false });
});

test('upload: métricas do BPMN e notação deduzida pela extensão', () => {
  const bpmn = bpmService.onUpload(Buffer.from(BPMN), { ext: 'bpmn', row: { notation: null } });
  assert.equal(bpmn.update.notation, 'bpmn');
  assert.equal(JSON.parse(bpmn.update.metrics).counts.tasks, 3);
  const png = bpmService.onUpload(Buffer.from([0x89, 0x50]), { ext: 'png', row: { notation: null } });
  assert.deepEqual(png.update, { metrics: null, notation: 'image' });
  const kept = bpmService.onUpload(Buffer.from('%PDF'), { ext: 'pdf', row: { notation: 'other' } });
  assert.equal(kept.update.notation, undefined);
});

test('processo: código normalizado, nível obrigatório', () => {
  const ok = processSchema.parse({ code: ' p1.2 ', name: 'Agendar', level: 'subprocess' });
  assert.equal(ok.code, 'P1.2');
  assert.equal(processSchema.safeParse({ code: 'P1', name: 'Agendar' }).success, false);
  assert.equal(processSchema.safeParse({ code: 'P1', name: 'Agendar', level: 'mega' }).success, false);
});

test('diagrama: estado AS IS / TO BE e URL validados', () => {
  assert.equal(diagramSchema.safeParse({ title: 'Agenda', state: 'to_be' }).success, true);
  assert.equal(diagramSchema.safeParse({ title: 'Agenda', state: 'futuro' }).success, false);
  assert.equal(diagramSchema.safeParse({ title: 'Agenda', url: 'x' }).success, false);
});

test('OpenAPI documenta processos, diagramas e o arquivo', () => {
  const { paths } = buildOpenApi();
  for (const p of ['', '/processes', '/processes/{id}', '/diagrams', '/diagrams/{id}', '/diagrams/{id}/file']) {
    assert.ok(paths[`/projects/{projectId}/bpm${p}`], p || '/');
  }
});
