# Examples — 3 casos validados end-to-end

Cada subpasta tem o output **real** que o `lp-forge` produziu, rodado em ~30-60 segundos via OpenAI gpt-4o-mini.

| Caso | URL fonte | Categoria | Comando usado |
|---|---|---|---|
| [`orto-implant/`](./orto-implant/) | https://ortoimplant.com.br | Clínica odontológica (SPA) | `--allow-playwright --primary-color "#c3ae5c"` |
| [`clinica-mariana/`](./clinica-mariana/) | https://clinicamarianalourenco.com.br | Clínica odontológica (WordPress) | `--allow-playwright --primary-color "#d97757"` |
| [`salao-piazza/`](./salao-piazza/) | https://salaopiazza.com.br | Salão de beleza | `--allow-playwright` |

## O que cada exemplo contém

```
{caso}/
├── analysis-report.md      ← Deliverable #1 (1300-1400 palavras LLM-gerado em PT-BR)
├── brand-spec.md           ← Spec da marca capturada (huashu §1.a)
├── business-spec.md        ← Dados do negócio (contato, serviços, horários)
└── page.tsx.example        ← Snippet do Next.js gerado (hero + sections)
```

## Heroes únicos por negócio (zero genérico)

A regra do prompt do copywriter força hero específico — não permite "Transforme seu sorriso com excelência" ou "Bem-vindo a..."

| Caso | Hero gerado |
|---|---|
| Orto Implant | "Implantes de qualidade em Nova Serrana" + "Atendimento humanizado e tecnologia avançada" |
| Clínica Mariana | "Sorriso perfeito com tecnologia de ponta em São Paulo" |
| Salão Piazza | "Beleza refinada em São Paulo, há 24 anos" + "Atendimento que valoriza cada cliente com carinho" |

## Análises distinguem-se por dados reais

Cada `analysis-report.md` referencia HEX cores específicas extraídas, arquétipos detectados, e métricas reais do site fonte. Nada de "tons dourados genéricos" — cita `#c3ae5c` quando é a cor real.

Veja os documentos completos por dentro de cada pasta.
