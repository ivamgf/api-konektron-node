// Leitura de um arquivo BPMN 2.0 (XML), sem bibliotecas: contagem dos elementos do modelo e
// nomes de processos, participantes (pools), raias e tarefas. Aceita qualquer prefixo (bpmn:, bpmn2:, semantic:).
const BPMN_MODEL_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const MAX_NAMES = 200;

const KINDS = {
  tasks: ['task', 'userTask', 'serviceTask', 'manualTask', 'scriptTask', 'businessRuleTask', 'sendTask', 'receiveTask'],
  subProcesses: ['subProcess', 'adHocSubProcess', 'transaction'],
  callActivities: ['callActivity'],
  startEvents: ['startEvent'],
  endEvents: ['endEvent'],
  intermediateEvents: ['intermediateCatchEvent', 'intermediateThrowEvent'],
  boundaryEvents: ['boundaryEvent'],
  gateways: ['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'],
  sequenceFlows: ['sequenceFlow'],
  messageFlows: ['messageFlow'],
  participants: ['participant'],
  lanes: ['lane'],
  dataObjects: ['dataObjectReference', 'dataStoreReference'],
};

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim();

const elements = (text, names) => [...text.matchAll(new RegExp(`<(?:[\\w-]+:)?(${names.join('|')})\\b([^>]*)>`, 'g'))];
const nameOf = (attrs) => {
  const raw = /\bname="([^"]*)"/.exec(attrs)?.[1];
  return raw ? decode(raw) : null;
};
const names = (matches) => [...new Set(matches.map(([, , attrs]) => nameOf(attrs)).filter(Boolean))].slice(0, MAX_NAMES);

/**
 * @param {Buffer} buffer
 * @returns {{ isBpmn: boolean, counts?, byType?, processes?, participants?, lanes?, taskNames?, hasLayout? }}
 */
export function analyzeBpmn(buffer) {
  const text = buffer.toString('utf8').replace(/^\s+/, ''); // BOM e espaços iniciais
  if (!text.includes(BPMN_MODEL_NS) || !/<(?:[\w-]+:)?definitions\b/.test(text)) return { isBpmn: false };

  const counts = {};
  const byType = {};
  for (const [kind, list] of Object.entries(KINDS)) {
    const found = elements(text, list);
    counts[kind] = found.length;
    if (['tasks', 'gateways'].includes(kind)) {
      byType[kind] = Object.fromEntries(list.map((n) => [n, found.filter(([, el]) => el === n).length]).filter(([, n]) => n));
    }
  }
  return {
    isBpmn: true,
    counts,
    byType,
    processes: names(elements(text, ['process'])),
    participants: names(elements(text, KINDS.participants)),
    lanes: names(elements(text, KINDS.lanes)),
    taskNames: names(elements(text, [...KINDS.tasks, ...KINDS.subProcesses, ...KINDS.callActivities])),
    hasLayout: /<(?:[\w-]+:)?BPMNDiagram\b/.test(text), // diagrama desenhável (BPMN DI)
  };
}
