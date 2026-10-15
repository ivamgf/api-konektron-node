// Ontologias — catálogo das ontologias de um projeto (qualquer tipo), com o arquivo publicado
export const FORMATS = [
  'rdf_xml', 'owl_xml', 'turtle', 'n_triples', 'n3', 'json_ld', 'rdfa', 'owl_functional', 'manchester', 'obo', 'xml', 'other',
];

// Vocabulários reutilizados (o analisador reconhece os namespaces de cada um)
export const VOCABULARIES = [
  'rdf', 'rdfs', 'owl', 'schema', 'rdfa', 'skos', 'dublin_core', 'foaf', 'prov', 'dcat', 'shacl', 'geo', 'vcard', 'org', 'sioc', 'other',
];

// Princípios de dados: FAIR, CARE (dados indígenas), 5 estrelas dos Linked Open Data, TRUST (repositórios)
export const PRINCIPLES = ['fair', 'care', 'five_star', 'trust', 'other'];

export const STATUS = ['draft', 'in_review', 'published', 'deprecated'];

export const FILE_EXTENSIONS = ['owl', 'rdf', 'owx', 'xml', 'ttl', 'nt', 'nq', 'n3', 'trig', 'jsonld', 'json', 'obo', 'ofn', 'omn', 'html'];

// Campos de contagem e o que cada um mede (rótulos da API e do analisador)
export const COUNT_FIELDS = ['classCount', 'relationshipCount', 'propertyCount', 'objectCount'];
