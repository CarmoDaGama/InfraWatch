O documento anexado é um **Software Design Document (SDD)** completo e oficial para a solução **InfraWatch**, desenvolvido pela empresa **EXIJA SERVIÇOS** (Angola). Ele tem **4 páginas** no formato PDF, com layout profissional, logotipo da empresa, imagens de captura de tela (screenshots) em todas as páginas e conteúdo em português. Abaixo, descrevo **tudo o que está no documento**, página por página, de forma detalhada, fiel e estruturada, incluindo textos, tabelas, listas, imagens e elementos visuais.

### **Página 1 – Capa / Folha de Rosto**
- **Título principal**: “Software Design Document – InfraWatch”
- **Empresa**: EXIJA SERVIÇOS
- **Slogan**: “CLIENTES SÃO PARCEIROS DE VALOR ACRESCENTADO”
- **Logotipo**: Logotipo oficial da RCS ANGOLA (quadrado azul com texto “RCS ANGOLA” e uma onda azul embaixo).
- **Elementos visuais**:
  - Um grande retângulo azul vertical à esquerda.
  - Uma barra horizontal azul com o nome da empresa na parte inferior direita.
  - Uma faixa decorativa colorida na base (azul, cinza, azul escuro, azul claro, cinza, azul escuro, azul).
- **Imagem**: Uma captura de tela completa da capa (screenshot.jpeg), mostrando exatamente o mesmo layout.

Não há texto adicional além do título e da empresa.

### **Página 2 – Introdução e Visão Geral do Sistema**
- **Título da seção**: 1. Introdução
- **Objetivo do Documento**:
  - Descreve o design da solução InfraWatch, uma plataforma de monitoramento de infraestruturas corporativas orientada ao utilizador final.
  - Centraliza a observação de redes, servidores, aplicações, endpoints, etc.
  - Fornece visibilidade em tempo real sobre estado, downtime, disponibilidade, alertas e métricas operacionais.
- **Escopo** (lista com 6 itens):
  - Conexão com múltiplas fontes (API, SNMP, ping, webhook, etc.)
  - Identificação automática de status (up/down)
  - Armazenamento histórico e visualização de métricas
  - Dashboards intuitivos focados no utilizador final
  - Alertas configuráveis (e-mail, notificação ou mensagem)
  - Mecanismo de SLA tracking (percentual de uptime)
- **Título da seção**: 2. Visão Geral do Sistema
- **Componentes principais** (lista com 4 itens):
  - Frontend responsivo com dashboards amigáveis
  - Motor de monitoramento (coleta dados em tempo real)
  - Sistema de notificações (alertas proativos)
  - Banco de dados temporal (armazena logs e históricos)
- **Imagem**: Captura de tela completa da página 2 (screenshot.jpeg), mostrando exatamente o mesmo texto formatado.

### **Página 3 – Requisitos Funcionais e Não-Funcionais**
- **Título da seção**: 3. Requisitos Funcionais
- **Tabela completa** (2 colunas: Código | Requisito):
  - RF01: Conectar-se a diferentes sistemas via API, SNMP, ping ou webhook
  - RF02: Detectar automaticamente mudanças de estado (up/down)
  - RF03: Registrar logs e métricas associadas a cada sistema monitorado
  - RF04: Apresentar as informações em dashboards personalizáveis
  - RF05: Enviar notificações automáticas por e-mail, SMS ou push
  - RF06: Permitir configuração de níveis de criticidade e regras de SLA
  - RF07: Armazenar métricas para análise histórica
  - RF08: Permitir múltiplos perfis de utilizador com permissões específicas
  - RF09: Integrar com ferramentas de gestão existentes (GLPI, DocuWare, etc.)
- **Título da seção**: 4. Requisitos Não-Funcionais
- **Tabela completa** (2 colunas: Código | Requisito):
  - RNF01: Interface intuitiva, moderna e multilíngue
  - RNF02: Tempo de verificação personalizável por sistema (ex: a cada 60s)
  - RNF03: Alta disponibilidade e tolerância a falhas
  - RNF04: Escalável horizontalmente
  - RNF05: Compatível com dispositivos móveis
  - RNF06: Mecanismos de autenticação e logs de auditoria
- **Imagem**: Captura de tela completa da página 3 (screenshot.jpeg), mostrando as duas tabelas formatadas.

### **Página 4 – Componentes do Sistema, Exemplos de Uso e Considerações Finais**
- **Título da seção**: 5. Componentes do Sistema
  - **5.1 Frontend (React ou Angular)**:
    - Dashboard principal com visão global
    - Indicadores em tempo real (status, uptime, alertas)
    - Página de relatórios e SLA
    - Gestão de perfis e permissões
  - **5.2 Backend (Node.js, Laravel ou Python)**:
    - Módulo de coleta e monitoramento (pooling, webhook, ping, etc.)
    - Motor de regras e alertas
    - Registro e tratamento de logs
    - API de integração
  - **5.3 Banco de Dados**:
    - Banco relacional (configuração, usuários, permissões)
    - Banco de séries temporais (ex: InfluxDB, TimescaleDB) para métricas
  - **5.4 Sistema de Notificações**:
    - Integração com e-mail, WhatsApp, Telegram, Slack, etc.
    - Regras de escalonamento por tipo de incidente
- **Título da seção**: 6. Exemplos de Uso
  - **Exemplo 1**: Servidor “ERP-PROD” está em status down há 3 minutos. O sistema exibe alerta visual em vermelho no dashboard e envia e-mail ao responsável.
  - **Exemplo 2**: Usuário visualiza SLA acumulado do serviço “Kiosks Self-Service” e observa 99.3% de uptime no mês corrente, com 3 falhas registradas.
- **Título da seção**: 7. Considerações Finais
  - A solução InfraWatch proporcionará visibilidade em tempo real do estado da infraestrutura tecnológica da organização, antecipando falhas e otimizando o tempo de reação da equipe técnica. A centralização da informação e o foco no utilizador final garantem acessibilidade, eficiência e agilidade nos processos operacionais.
- **Imagem**: Captura de tela completa da página 4 (screenshot.jpeg), mostrando toda a seção formatada.

### **Elementos Gerais Presentes em Todas as Páginas**
- Rodapé decorativo com faixa colorida (azul, cinza, azul escuro, azul claro, cinza, azul escuro, azul).
- Logotipo da EXIJA SERVIÇOS em todas as páginas.
- Imagens de captura de tela (screenshot.jpeg) repetidas em cada página, servindo como visualização exata do conteúdo impresso.
- Formatação profissional: títulos numerados, listas com bullets, tabelas com bordas, texto justificado, negrito em seções importantes.

### **Resumo Geral do Documento**
O documento é um SDD clássico, com **7 seções principais** (Introdução, Visão Geral, Requisitos Funcionais, Requisitos Não-Funcionais, Componentes, Exemplos de Uso e Considerações Finais). Ele define claramente o InfraWatch como uma plataforma de monitoramento centralizada, orientada ao utilizador final, com foco em tempo real, dashboards, alertas, SLA e integração com ferramentas externas (GLPI, DocuWare). Não há diagramas técnicos, código-fonte ou especificações de API detalhadas — é um documento de alto nível para orientação de desenvolvimento.

Tudo o que está no documento foi descrito acima de forma completa e fiel. Se precisar de uma transcrição exata de algum trecho, foco em uma seção específica ou análise adicional, é só pedir!