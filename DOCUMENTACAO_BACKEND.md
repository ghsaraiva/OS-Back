# Documentação do Backend - Sistema de Cálculos Fotovoltaicos

Este documento descreve o ecossistema de rotas e a lógica de negócios para dimensionamento solar, estruturado para funcionar em tempo real conforme o preenchimento do front-end.

---

## 1. Arquitetura e Fluxo
A API é organizada em **4 Seções Síncronas** que devem ser chamadas sequencialmente de cima para baixo.

---

## 2. Seção 1: Captação
**Rota:** `POST /api/calculos/dimensionamento-minimo`

Calcula o potencial de geração mínima com base no gasto financeiro ou consumo.

#### Parâmetros:
- `id_cidade`: ID da cidade na coleção `cidades_hsp`.
- `consumo_mes`: Valor total da conta (R$) ou consumo mensal.
- `valor_tarifa`: Valor da tarifa por kWh.
- `nome_cliente`, `estado`, `cidade`, `observacao`, `estrutura`, `padrao`: Campos informativos enviados pelo frontend.

#### Lógica:
1. `consumo_mensal_kwh = consumo_mes / valor_tarifa`
2. `hsp_diario = mediacalc / 1000` (Busca no PocketBase pelo `id_cidade`)
3. `hsp_mensal = hsp_diario * 30`
4. `kwp_minimo = consumo_mensal_kwh / hsp_mensal`

---

## 3. Seção 2: Equipamentos
**Rotas:** 
- `POST /api/calculos/sistema-real`: Calcula kWp total dos painéis escolhidos.
- `POST /api/calculos/retorno-financeiro`: Calcula geração estimada e economia em R$.

#### Lógica Retorno:
1. `geracao_mensal_kwh = Math.round(kwp_sistema * hsp_mensal)`
2. `economia_mensal_rs = geracao_mensal_kwh * valor_tarifa`

---

## 4. Seção 3: Dinâmica do Kit
**Rota:** `POST /api/calculos/licenciamento-kit`

Calcula o lucro extra sobre o kit e o valor total licenciado.

#### Parâmetros:
- `valorKit`: Preço bruto do fornecedor.
- `valorPorcentagem`: Margem de licenciamento manual (ex: 10 para 10%).

#### Lógica:
1. `lucroEquipamentoFinal = valorKit * (valorPorcentagem / 100)`
2. `valorKitLicenciado = valorKit + lucroEquipamentoFinal`

---

## 5. Seção 4: Cascata do Projeto (Precificação Final)
**Rota:** `POST /api/calculos/preco-final`

Implementa a matemática de **Markup Divisor** corrigida para resolver dependências de impostos e seguros sobre o valor de venda.

#### Parâmetros:
- `valorKitLicenciado`: Do passo anterior.
- `valorMaoDeObra`, `valorEquipamentoLocal`, `valorHomologacao`: Custos fixos.
- `porcentagemLucroLiquido`: Margem desejada sobre a venda.

#### Lógica do Markup Divisor:
1. **Custo Base**: `custoProjeto = Kit + MaoDeObra + EquipLocal + Homo`
2. **Margem de Segurança (3%)**: `margemSeguranca = (Kit / 0.97) - Kit`
3. **Divisor**: `1 - (% Lucro / 100) - 0.015 (Seguro) - 0.15 (Imposto)`
4. **Preço Final Sugerido**: `(custoProjeto + margemSeguranca - (0.15 * Kit)) / divisor`

#### Fatiamento da Venda:
- `Seguro (1.5%)`: `Preço Final * 0.015`
- `Lucro Líquido`: `Preço Final * (% Lucro / 100)`
- `Imposto (15% sobre o valor faturado)`: `(Preço Final - Kit) * 0.15`

---

## 6. Comandos e Testes
- **Dev:** `npm run dev`
- **Testes:** `npm test` (Inclui Prova Real da Seção 4)
