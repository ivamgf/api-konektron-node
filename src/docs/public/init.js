// Inicializa o Swagger UI (arquivo separado porque a CSP da página não permite script inline)
const ui = SwaggerUIBundle({
  url: 'openapi.json',
  dom_id: '#swagger-ui',
  deepLinking: true,
  persistAuthorization: true, // mantém o token ao recarregar a página
  displayRequestDuration: true,
  filter: true,
  docExpansion: 'none',
  defaultModelsExpandDepth: 0,
  tryItOutEnabled: false,
  // Login, cadastro, refresh ou troca de senha feitos aqui já autorizam as próximas chamadas
  responseInterceptor: (res) => {
    const token = res.ok && res.body && res.body.accessToken;
    if (token) ui.preauthorizeApiKey('bearerAuth', token);
    return res;
  },
});

window.ui = ui;
