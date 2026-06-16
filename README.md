# Backend - API de Cálculos Fotovoltaicos & Integração

API de apoio do sistema de Orçamentos Solares. Ela é responsável por realizar todo o processamento matemático complexo de dimensionamento técnico, retorno financeiro sobre o investimento (payback) e a cascata de precificação comercial, servindo como intermediária e processadora lógica das informações integradas ao **PocketBase**.

---

## 🛠️ Stack
* **Node.js** com **TypeScript**
* **Express** 
* **Vitest** 
* **PocketBase SDK** 

---

## 📐 Detalhamento dos Cálculos & Regras de Negócio

A API é estruturada em seções lógicas sequenciais para atender ao refinamento progressivo dos dados vindos do frontend:

### ☀️ Seção 1: Captação (Dimensionamento Mínimo)
Calcula a potência mínima do gerador fotovoltaico (em kWp) necessária para suprir o consumo médio mensal do cliente.
1. **Consumo Estimado em kWh:**
   $$\text{Consumo Mensal (kWh)} = \frac{\text{Gasto Mensal (R\$)}}{\text{Valor da Tarifa (R\$/kWh)}}$$
2. **Índice de Irradiação Solar (HSP - Horas de Sol Pleno):**
   * Busca no banco de dados o valor `mediacalc` (em Wh/m²) da cidade e converte para HSP diário:
     $$\text{HSP Diário} = \frac{\text{mediacalc}}{1000}$$
   * Multiplica-se por 30 para obter a irradiação mensal útil:
     $$\text{HSP Mensal} = \text{HSP Diário} \times 30$$
3. **Potência Mínima do Gerador (kWp):**
   $$\text{kWp Mínimo} = \frac{\text{Consumo Mensal (kWh)}}{\text{HSP Mensal}}$$

---

### 🔌 Seção 2: Equipamentos (Geração e Retorno Financeiro)
Calcula a geração elétrica real estimada com base no sistema escolhido (quantidade e potência dos painéis) e as perdas financeiras devidas às regras de faturamento/compensação (TUSD e Fio B).
1. **Área Estimada do Telhado (m²):**
   $$\text{Área Total} = \text{Quantidade de Painéis} \times 2.5\text{ m²}$$
2. **Geração Mensal Estimada (kWh):**
   $$\text{Geração Mensal (kWh)} = \text{kWp do Sistema} \times \text{HSP Diário} \times 30$$
3. **Encargos sobre a Geração (Regras de Faturamento e TUSD):**
   * O sistema calcula os encargos internos de TUSD (Tarifa de Uso do Sistema de Distribuição), aplicando o imposto e o Fio B sobre a geração:
     $$\text{TUSD Interno} = \text{Valor Tarifa} \times \text{Geração Mensal} \times 0.51$$
     $$\text{Imposto TUSD} = \text{TUSD Interno} \times 0.18$$
     $$\text{Fio B TUSD} = \text{TUSD Interno} \times 0.22$$
     $$\text{Valor Pago Mês (Encargos)} = \text{Imposto TUSD} + \text{Fio B TUSD}$$
4. **Economia Mensal Líquida (R$):**
   $$\text{Economia Mensal (R\$)} = (\text{Geração Mensal} \times \text{Valor Tarifa}) - \text{Valor Pago Mês}$$
   *(O sistema ajusta o cálculo considerando o padrão de conexão do cliente - Monofásico, Bifásico ou Trifásico - para deduzir o custo de disponibilidade mínima obrigatória).*

---

### 📦 Seção 3: Dinâmica do Kit (Licenciamento)
Calcula o valor licenciado do kit (gerador solar) aplicando a margem de lucro operacional sobre o custo de aquisição do fornecedor.
1. **Lucro do Equipamento (R$):**
   $$\text{Lucro Equipamento} = \text{Valor Kit Fornecedor} \times \frac{\text{Porcentagem Licenciamento}}{100}$$
2. **Valor Kit Licenciado (R$):**
   $$\text{Valor Kit Licenciado} = \text{Valor Kit Fornecedor} + \text{Lucro Equipamento}$$

---

### 💸 Seção 4: Cascata do Projeto (Precificação por Markup Divisor)
Usa o método do **Markup Divisor** para calcular o Preço Final de Venda sugerido. Esse método garante que impostos e seguro (que incidem sobre a venda final) sejam cobrados proporcionalmente sobre o valor cheio de venda, mantendo a margem líquida exata escolhida.
1. **Custo Base do Projeto (R$):**
   $$\text{Custo Projeto} = \text{Kit Licenciado} + \text{Mão de Obra} + \text{Equipamento Local} + \text{Homologação}$$
2. **Margem de Segurança (3% sobre o Kit):**
   $$\text{Margem Segurança} = \frac{\text{Kit Licenciado}}{0.97} - \text{Kit Licenciado}$$
3. **Fórmula do Markup Divisor:**
   * Imposto de faturamento: 15%
   * Seguro de faturamento: 1.5%
   $$\text{Divisor} = 1 - \left(\frac{\% \text{ Lucro Líquido Desejado}}{100}\right) - 0.015 - 0.15$$
4. **Preço Final de Venda Sugerido (R$):**
   $$\text{Preço Final} = \frac{\text{Custo Projeto} + \text{Margem Segurança} - (0.15 \times \text{Kit Licenciado})}{\text{Divisor}}$$
5. **Fatiamento Detalhado da Venda:**
   * **Seguro:** $\text{Preço Final} \times 0.015$ (1.5%)
   * **Lucro Líquido:** $\text{Preço Final} \times \frac{\% \text{ Lucro}}{100}$
   * **Imposto (15% sobre o valor agregado):** $(\text{Preço Final} - \text{Kit Licenciado}) \times 0.15$

---

## 🚀 Instalação & Execução

### 🔧 Configuração do Ambiente
1. Copie o arquivo `.env.example` para `.env`:
   ```env
   PORT=3002
   POCKETBASE_URL=http://localhost:8090
   POCKETBASE_ADMIN_EMAIL=seu-email@dominio.com
   POCKETBASE_ADMIN_PASSWORD=sua-senha-segura
   ```

### 💻 Comandos Úteis
* **Instalar dependências:** `npm install`
* **Executar em modo desenvolvimento:** `npm run dev`
* **Compilar para produção:** `npm run build`
* **Executar suíte de testes:** `npm run test`

---

## 🔒 Autenticação & Segurança de API

Todas as rotas expostas pelo backend são protegidas de forma nativa:
1. **Middleware de Autenticação (`authenticateToken`):** Valida o cabeçalho `Authorization: Bearer <token>` em todas as requisições com o servidor do PocketBase. A requisição recebe uma instância isolada (`req.pb`) do banco, fazendo com que as operações de escrita e leitura ocorram sob as regras de privilégios e segurança daquele usuário logado (eliminando o bypass de credenciais).
2. **Middleware de Autorização (`authorizeRoles`):** Bloqueia imediatamente o acesso a determinados endpoints dependendo da permissão do usuário (ex: a rota `/salvar-refinamento` é exclusiva para usuários com `tipo_acesso: 'admin'`).
3. **Rate Limiting:** Bloqueio ativo contra ataques DDoS ou força bruta por IP (máximo de 300 requisições por IP a cada 15 minutos).
4. **Helmet:** Cabeçalhos HTTP de segurança injetados automaticamente no servidor Express.
