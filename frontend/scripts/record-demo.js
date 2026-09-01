import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações da Gravação
const BASE_URL = process.env.DEMO_URL || process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://164.152.62.48';
const USERNAME = process.env.DEMO_USER || 'ArturK';
const PASSWORD = process.env.DEMO_PASS || '2007@Rture';
const OUTPUT_DIR = path.resolve(__dirname, '../videos');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function humanType(page, selector, text, delayMs = 30) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.focus();
  for (const char of text) {
    await page.keyboard.type(char, { delay: delayMs });
  }
  await sleep(300);
}

async function smoothScroll(page, yTarget, durationMs = 1200) {
  await page.evaluate(async ({ yTarget, durationMs }) => {
    const startY = window.scrollY;
    const diff = yTarget - startY;
    const startTime = performance.now();

    await new Promise((resolve) => {
      function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        window.scrollTo(0, startY + diff * ease);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }, { yTarget, durationMs });
  await sleep(400);
}

async function recordDemo() {
  console.log(`\n======================================================`);
  console.log(`🎬 [CodeSync] Iniciando Gravação Automatizada de Demonstração`);
  console.log(`🌐 Alvo: ${BASE_URL}`);
  console.log(`👤 Usuário: ${USERNAME}`);
  console.log(`📁 Diretório de Saída: ${OUTPUT_DIR}`);
  console.log(`======================================================\n`);

  const WIDTH = 1920;
  const HEIGHT = 1080;

  const browser = await chromium.launch({
    headless: false,
    slowMo: 30,
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      '--force-device-scale-factor=1',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: WIDTH, height: HEIGHT }
    },
    colorScheme: 'dark'
  });

  const page = await context.newPage();

  try {
    // ----------------------------------------------------
    // CENA 1: LANDING PAGE — APRESENTAÇÃO & HERO (0-6s)
    // ----------------------------------------------------
    console.log('📌 Cena 1: Landing Page & Apresentação Visual...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(1500);

    await smoothScroll(page, 550, 1000);
    await sleep(800);
    await smoothScroll(page, 0, 800);
    await sleep(600);

    // ----------------------------------------------------
    // CENA 2: LOGIN COM ARTURK (6-15s)
    // ----------------------------------------------------
    console.log(`📌 Cena 2: Autenticação com usuário '${USERNAME}'...`);
    const authBtn = page.locator('button:has-text("Área de Usuário"), button:has-text("Entrar com Conta"), button:has-text("Login")').first();
    if (await authBtn.isVisible({ timeout: 2500 })) {
      await authBtn.click();
      await sleep(1000);
    }

    const userInput = page.locator('input[placeholder="Nome de usuário"]').first();
    await userInput.waitFor({ state: 'visible', timeout: 5000 });
    await humanType(page, 'input[placeholder="Nome de usuário"]', USERNAME, 35);
    await humanType(page, 'input[placeholder="Senha"]', PASSWORD, 35);
    await sleep(400);

    const formSubmit = page.locator('form button[type="submit"]').first();
    if (await formSubmit.isVisible({ timeout: 2000 })) {
      await formSubmit.click();
    } else {
      await page.keyboard.press('Enter');
    }

    await sleep(2500);

    // ----------------------------------------------------
    // CENA 3: DASHBOARD & CRIAÇÃO DA SALA (15-25s)
    // ----------------------------------------------------
    console.log('📌 Cena 3: Dashboard — Criando nova sessão...');
    const projectInput = page.locator('input[placeholder="Nome do projeto..."]').first();
    await projectInput.waitFor({ state: 'visible', timeout: 8000 });

    const roomName = `CodeSync Fullstack ${Math.floor(Math.random() * 900 + 100)}`;
    await humanType(page, 'input[placeholder="Nome do projeto..."]', roomName, 30);
    await sleep(400);

    const createSessionBtn = page.locator('button:has-text("+ Criar Sessão")').first();
    await createSessionBtn.click();
    await sleep(1500);

    console.log('📌 Cena 3.1: Clicando em "Entrar Agora"...');
    const enterNowBtn = page.locator('button:has-text("Entrar Agora")').first();
    await enterNowBtn.waitFor({ state: 'visible', timeout: 8000 });
    await sleep(800);
    await enterNowBtn.click();

    await page.waitForURL(/sessionId=/, { timeout: 15000 });
    console.log('📌 IDE Carregada com Sucesso!');
    await sleep(3500);

    // ----------------------------------------------------
    // CENA 4: CRIAÇÃO DO ARQUIVO test.js (25-35s)
    // ----------------------------------------------------
    console.log('📌 Cena 4: Criando arquivo test.js no Explorer...');
    const newFileBtn = page.locator('button[title*="Novo Arquivo"], .codicon-new-file, button:has(.codicon-new-file)').first();
    if (await newFileBtn.isVisible({ timeout: 4000 })) {
      await newFileBtn.click();
      await sleep(800);

      const fileNameInput = page.locator('input[placeholder="meu-arquivo"], input[placeholder*="arquivo"]').first();
      await fileNameInput.waitFor({ state: 'visible', timeout: 5000 });
      await humanType(page, 'input[placeholder="meu-arquivo"], input[placeholder*="arquivo"]', 'test', 40);
      await sleep(500);

      const createModalBtn = page.locator('div.fixed button:has-text("Criar"), button:has-text("Criar")').last();
      await createModalBtn.click();
      await sleep(2000);
    }

    // ----------------------------------------------------
    // CENA 5: MONACO EDITOR — CÓDIGO SIMPLES (35-45s)
    // ----------------------------------------------------
    console.log('📌 Cena 5: Digitando código simples em test.js...');
    const monacoEditor = page.locator('.monaco-editor').first();
    if (await monacoEditor.isVisible({ timeout: 4000 })) {
      await monacoEditor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await sleep(300);

      const codeSnippet = [
        '// 🚀 CodeSync Cloud IDE — Teste de Execução Rápida',
        'console.log("=========================================");',
        'console.log("⚡ Executando código ao vivo no CodeSync!");',
        'const somar = (a, b) => a + b;',
        'console.log("Resultado de 50 + 50 =", somar(50, 50));',
        'console.log("🟢 Ambiente Node.js pronto para Fullstack!");',
        'console.log("=========================================");'
      ].join('\n');

      await page.keyboard.insertText(codeSnippet);
      await sleep(1000);
      await page.keyboard.press('Control+S');
      await sleep(1000);
    }

    // ----------------------------------------------------
    // CENA 6: EXECUTAR NO TERMINAL PTY (45-55s)
    // ----------------------------------------------------
    console.log('📌 Cena 6: Focando no Terminal e Executando test.js...');
    const xtermArea = page.locator('.xterm-helper-textarea').first();
    if (await xtermArea.isVisible({ timeout: 3000 })) {
      await xtermArea.focus();
      await page.keyboard.type('node test.js', { delay: 35 });
      await page.keyboard.press('Enter');
      await sleep(3000);
    }

    // ----------------------------------------------------
    // CENA 7: AGENTE DE IA (BARRA LATERAL) & APROVAR TODOS (55-90s)
    // ----------------------------------------------------
    console.log('📌 Cena 7: Abrindo CodeSync AI Agent pelo botão lateral (Robô)...');
    const aiSidebarBtn = page.locator('button[title="AI Assistant"], button:has(.codicon-robot)').first();
    if (await aiSidebarBtn.isVisible({ timeout: 4000 })) {
      await aiSidebarBtn.click();
      await sleep(1500);

      const aiInput = page.locator('textarea[placeholder*="Pergunte"], input[placeholder*="Pergunte"], textarea').first();
      if (await aiInput.isVisible({ timeout: 3000 })) {
        const aiPrompt = 'Crie uma aplicação web com Node.js/Express, index.html moderno, styles.css estilizado e script.js interativo na porta 3000.';
        await humanType(page, 'textarea, input[placeholder*="Pergunte"]', aiPrompt, 25);
        await sleep(500);

        // Envia a mensagem para a IA
        const sendAiBtn = page.locator('button[title*="Enviar"], button:has(.codicon-send)').first();
        if (await sendAiBtn.isVisible({ timeout: 1500 })) {
          await sendAiBtn.click();
        } else {
          await page.keyboard.press('Enter');
        }

        console.log('📌 Aguardando o Agente de IA responder e gerar a proposta de arquivos...');
        
        // Espera especificamente o botão "Aprovar Todos" surgir no chat da IA
        const approveAllBtn = page.locator('button:has-text("Aprovar Todos"), button:has-text("Aprovar todos")').first();
        try {
          await approveAllBtn.waitFor({ state: 'visible', timeout: 45000 });
          await sleep(1500);
          console.log('📌 Clicando em "Aprovar Todos" para aplicar os arquivos no projeto...');
          await approveAllBtn.click();
          await sleep(3500);
        } catch (e) {
          console.log('⚠️ Botão Aprovar Todos demorou ou não apareceu, prosseguindo...');
        }
      }

      // Fecha o modal da IA com calma após a aprovação
      console.log('📌 Fechando modal da IA após aprovação...');
      const closeAiBtn = page.locator('button[title*="Fechar"], button:has-text("Fechar"), .codicon-close').first();
      if (await closeAiBtn.isVisible({ timeout: 2000 })) {
        await closeAiBtn.click();
        await sleep(1500);
      }
    }

    // ----------------------------------------------------
    // CENA 8: EXECUTAR NPM INSTALL & NPM START NO TERMINAL (90-110s)
    // ----------------------------------------------------
    console.log('📌 Cena 8: Executando npm install && npm start no Terminal PTY...');
    if (await xtermArea.isVisible({ timeout: 3000 })) {
      await xtermArea.focus();
      await page.keyboard.type('npm install && npm start', { delay: 25 });
      await page.keyboard.press('Enter');
      console.log('📌 Aguardando servidor iniciar na porta 3000...');
      await sleep(7000);
    }

    // ----------------------------------------------------
    // CENA 9: ABRIR BROWSER INTERNO (BARRA LATERAL - ÍCONE ABAIXO DO ROBÔ) (110-125s)
    // ----------------------------------------------------
    console.log('📌 Cena 9: Abrindo Browser Interno (botão abaixo do robô)...');
    const browserSidebarBtn = page.locator('button[title="Browser Interno"]').first();
    if (await browserSidebarBtn.isVisible({ timeout: 4000 })) {
      await browserSidebarBtn.click();
      console.log('📌 Browser Interno aberto na porta :3000!');
      await sleep(4500);

      // Clica no botão de recarregar dentro do Browser Interno
      const refreshBrowserBtn = page.locator('button[title*="Recarregar"], .codicon-refresh').first();
      if (await refreshBrowserBtn.isVisible({ timeout: 2000 })) {
        await refreshBrowserBtn.click();
        await sleep(3000);
      }

      // Fecha o Browser Interno
      const closeBrowserBtn = page.locator('button[title*="Fechar"], button:has-text("Fechar"), .codicon-close').last();
      if (await closeBrowserBtn.isVisible({ timeout: 2000 })) {
        await closeBrowserBtn.click();
        await sleep(1200);
      }
    }

    // ----------------------------------------------------
    // CENA 10: TROCA DINÂMICA DE TEMAS & FINALIZAÇÃO (125-135s)
    // ----------------------------------------------------
    console.log('📌 Cena 10: Alternando Temas de Design...');
    const themeSelect = page.locator('select, button:has-text("Tema"), button[title*="Tema"]').first();
    if (await themeSelect.isVisible({ timeout: 2000 })) {
      const themesToTry = ['cyber_glass', 'dracula', 'aurora', 'neobrutalism-dark'];
      for (const t of themesToTry) {
        try {
          await themeSelect.selectOption(t);
          await sleep(1200);
        } catch (_) {}
      }
    }

    console.log('🏁 Gravação concluída com sucesso!');
    await sleep(2000);

  } catch (err) {
    console.error('⚠️ Erro durante o fluxo de gravação:', err.message);
  } finally {
    const video = await page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const finalFileName = `codesync-fullstack-demo-${Date.now()}.webm`;
      const finalPath = path.join(OUTPUT_DIR, finalFileName);
      await video.saveAs(finalPath);

      console.log(`\n======================================================`);
      console.log(`🎉 Gravação Finalizada com SUCESSO!`);
      console.log(`📹 Vídeo salvo em: ${finalPath}`);
      console.log(`======================================================\n`);
    }
  }
}

recordDemo();
