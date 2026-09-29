/**
 * Páginas públicas estilizadas para situações de QR Code não encontrado ou desativado
 */

export function renderNotFoundPage(code: string, baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Code Não Encontrado - QR Placas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #0B0F17;
      color: #F1F5F9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #111827;
      border: 1px solid #1F2937;
      border-radius: 1rem;
      max-width: 480px;
      width: 100%;
      padding: 2.5rem 2rem;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #374151;
      color: #9CA3AF;
      font-size: 0.8125rem;
      font-family: 'JetBrains Mono', monospace;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      margin-bottom: 1.5rem;
      letter-spacing: 0.05em;
    }
    .icon {
      width: 56px;
      height: 56px;
      margin: 0 auto 1.5rem;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #EF4444;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    p {
      color: #94A3B8;
      font-size: 0.9375rem;
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .code-box {
      background: #0B0F17;
      border: 1px dashed #374151;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
    }
    .code-box span { color: #64748B; }
    .code-box code { font-family: 'JetBrains Mono', monospace; color: #F59E0B; font-weight: 600; font-size: 1rem; }
    .footer {
      font-size: 0.8125rem;
      color: #475569;
      border-top: 1px solid #1F2937;
      padding-top: 1.25rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <div class="badge">STATUS: 404</div>
    <h1>QR Code Não Encontrado</h1>
    <p>O código escaneado não foi localizado em nossa base de placas cadastradas. Verifique se o código impresso na placa ou etiqueta NFC está correto.</p>
    
    <div class="code-box">
      <span>Código Lido:</span>
      <code>${code.toUpperCase()}</code>
    </div>

    <div class="footer">
      Plataforma de QR Codes Dinâmicos & NFC &bull; Sistema Seguro
    </div>
  </div>
</body>
</html>`;
}

export function renderDeactivatedPage(code: string, baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Code Temporariamente Indisponível - QR Placas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #0B0F17;
      color: #F1F5F9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #111827;
      border: 1px solid #1F2937;
      border-radius: 1rem;
      max-width: 480px;
      width: 100%;
      padding: 2.5rem 2rem;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 56px;
      height: 56px;
      margin: 0 auto 1.5rem;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #F59E0B;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(245, 158, 11, 0.15);
      color: #FBBF24;
      font-size: 0.8125rem;
      font-family: 'JetBrains Mono', monospace;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      margin-bottom: 1.5rem;
      letter-spacing: 0.05em;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    p {
      color: #94A3B8;
      font-size: 0.9375rem;
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .code-box {
      background: #0B0F17;
      border: 1px dashed #374151;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
    }
    .code-box span { color: #64748B; }
    .code-box code { font-family: 'JetBrains Mono', monospace; color: #94A3B8; font-weight: 600; font-size: 1rem; }
    .footer {
      font-size: 0.8125rem;
      color: #475569;
      border-top: 1px solid #1F2937;
      padding-top: 1.25rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <div class="badge">STATUS: PAUSADO</div>
    <h1>Placa Temporariamente Indisponível</h1>
    <p>O proprietário desta placa pausou temporariamente o redirecionamento deste QR Code. Por favor, tente novamente mais tarde.</p>
    
    <div class="code-box">
      <span>Código da Placa:</span>
      <code>${code.toUpperCase()}</code>
    </div>

    <div class="footer">
      Plataforma de QR Codes Dinâmicos & NFC &bull; Atendimento ao Cliente
    </div>
  </div>
</body>
</html>`;
}
