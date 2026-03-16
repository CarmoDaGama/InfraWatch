import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/components/MetricsDrawer.tsx', 'utf8');
const R = c.includes('\r\n') ? '\r\n' : '\n';
const nl = R;

// Fix 1: SlaStatusBadge — add useTranslation hook and fix 'Sem dados'
c = c.replace(
  'function SlaStatusBadge({ sla_met }) {' + nl +
  '  if (sla_met === null || sla_met === undefined) {' + nl +
  '    return <span className="text-xs text-gray-400">Sem dados</span>',
  'function SlaStatusBadge({ sla_met }) {' + nl +
  "  const { t } = useTranslation()" + nl +
  '  if (sla_met === null || sla_met === undefined) {' + nl +
  '    return <span className="text-xs text-gray-400">{t(\'sla.noData\')}</span>'
);

// Fix 2: Main component — inject useTranslation + formatAge after saving state
const savingMarker =
  '  const [saving,     setSaving]     = useState(false)' + nl +
  '  const [saveError,  setSaveError]  = useState(null)' + nl;

const savingReplacement =
  '  const [saving,     setSaving]     = useState(false)' + nl +
  '  const [saveError,  setSaveError]  = useState(null)' + nl +
  nl +
  "  const { t } = useTranslation()" + nl +
  nl +
  '  function formatAge(ts) {' + nl +
  "    if (!ts) return '\u2014'" + nl +
  '    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)' + nl +
  "    if (diff < 5)    return t('deviceTable.justNow')" + nl +
  "    if (diff < 60)   return t('deviceTable.secondsAgo', { diff })" + nl +
  "    if (diff < 3600) return t('deviceTable.minutesAgo', { diff: Math.floor(diff / 60) })" + nl +
  '    return new Date(ts).toLocaleTimeString()' + nl +
  '  }' + nl;

c = c.replace(savingMarker, savingReplacement);

// Fix 3: Replace all remaining hardcoded strings in JSX
const replacements = [
  // SLA save validation
  ["'SLA deve ser um número entre 0 e 100.'", "t('detail.slaValidation')"],
  // Interval validation
  [/`Intervalo deve ser um inteiro entre \$\{MIN_CHECK_INTERVAL_SECONDS\} e \$\{MAX_CHECK_INTERVAL_SECONDS\} segundos\.`/,
    "t('detail.intervalValidation', { min: MIN_CHECK_INTERVAL_SECONDS, max: MAX_CHECK_INTERVAL_SECONDS })"],
  // Saving / Save button
  ["'A guardar…' : 'Guardar'", "t('detail.saving') : t('detail.save')"],
  // Editar SLA button text
  [/>Editar SLA</g, ">{t('detail.editSla')}<"],
  // Card titles
  ['<Card title="Estado atual">', "<Card title={t('detail.currentState')}>"],
  ['<Card title="SLA & Criticidade">', "<Card title={t('detail.slaTitle')}>"],
  [/<Card title=\{`Estatísticas · \$\{WINDOWS\.find\(w => w\.hours === hours\)\?\.label \?\? `\$\{hours\}h`\}`\}>/,
    "<Card title={t('detail.stats', { window: WINDOWS.find(w => w.hours === hours)?.label ?? `${hours}h` })}>"],
  // Ocorrências de downtime card
  ['<Card title="Ocorrências de downtime">', "<Card title={t('detail.downtimes')}>"],
  // Status text
  ["device.status === 'up' ? 'Operacional' : device.status === 'down' ? 'Offline' : 'Desconhecido'",
    "device.status === 'up' ? t('detail.operational') : device.status === 'down' ? t('detail.offline') : t('detail.unknown')"],
  // Nunca verificado
  ["device.lastChecked ? formatAge(device.lastChecked) : 'Nunca verificado'",
    "device.lastChecked ? formatAge(device.lastChecked) : t('detail.neverChecked')"],
  // StatRow labels
  ['label="Tempo de resposta"', "label={t('detail.responseTime')}"],
  ['label="Intervalo de verificação"', "label={t('detail.checkInterval')}"],
  ["label=\"Criticidade\"", "label={t('detail.criticality')}"],
  ['label="Target SLA"', "label={t('detail.targetSla')}"],
  ['label="Uptime real"', "label={t('detail.realUptime')}"],
  ['label="Total checks"', "label={t('detail.totalChecks')}"],
  ['label="Up"', "label={t('detail.up')}"],
  ['label="Down"', "label={t('detail.down')}"],
  ['label="Uptime"', "label={t('detail.uptime')}"],
  ['label="Média resp."', "label={t('detail.avgResp')}"],
  ['label="Mín / Máx resp."', "label={t('detail.minMaxResp')}"],
  // Último check label
  [">`Último check: ${formatAge(device.lastChecked)}`<", ">{`${t('detail.lastCheck')}: ${formatAge(device.lastChecked)}`}<"],
  [/<span>Último check: \{formatAge\(device\.lastChecked\)\}<\/span>/,
    "<span>{t('detail.lastCheck')}: {formatAge(device.lastChecked)}</span>"],
  // Edit form labels
  ['>Criticidade</label', ">{t('detail.criticality')}</label"],
  ['>Target SLA \\(%\\)</label', ">{t('detail.targetSla')} (%)</label"],
  ['>Intervalo de verificação \\(s\\)</label', ">{t('detail.checkInterval')} (s)</label"],
];

replacements.forEach(([from, to]) => {
  if (typeof from === 'string') {
    c = c.split(from).join(to);
  } else {
    c = c.replace(from, to);
  }
});

writeFileSync('src/components/MetricsDrawer.tsx', c);

// Verify
const hardcoded = [
  'agora mesmo', 'Voltar', 'SLA deve ser', 'Intervalo deve ser',
  'A guardar…', 'Guardar', 'Cancelar', 'Editar SLA',
  'Estado atual', 'SLA & Criticidade', 'Nunca verificado',
  'Operacional', 'Offline', 'Desconhecido',
  'Tempo de resposta', 'Intervalo de verificação',
  'Target SLA', 'Uptime real', 'Total checks', 'Média resp.',
  'Mín / Máx resp.', 'Histórico de resposta',
  'Ocorrências de downtime', 'checks em down', 'Sem dados',
  'Estatísticas ·'
];
const still = hardcoded.filter(s => c.includes(s));
console.log('MetricsDrawer.tsx fix complete!');
console.log('Remaining hardcoded:', still.length ? still : 'NONE');
console.log('Has t():', c.includes("useTranslation()"));
console.log('Has formatAge with t():', c.includes("t('deviceTable.justNow')"));
