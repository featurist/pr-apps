function escapeHtml (text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, t => map[t])
}

function renderDeployment (deployment) {
  return withLayout(
    {title: `${deployment.prAppName} deployment - ${deployment.id}`},
    () => `
      <div class="deployInfo">
        <div class="status ${deployment.status}">${deployment.status}</div>
        <div>${deployment.createdAt.toTimeString()}</div>
        <div><a class="flynnAppUrl" href="${deployment.flynnAppUrl}">flynn dashboard</a></div>
        <div><a class="deployedAppUrl" href="${deployment.deployedAppUrl}">deployed app</a></div>
        <!-- div><button>⟳ redeploy</button></div -->
      </div>
      <h2>\`git push\` logs</h2>
      <div class="logChunks">
        ${
          deployment.LogChunks.map(({text}) => {
            return `<div class="logChunk"><code>${escapeHtml(text)}</code></div>`
          }).join('\n')
        }
      </div>
    `
  )
}

function withLayout ({title}, renderBody) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/style.css" type="text/css">
  </head>
  <body>
    ${renderBody()}
  </body>
</html>
  `
}

module.exports = {
  renderDeployment
}