const fs = require('fs');
const content = fs.readFileSync('c:/CorpFlowSFMAC/src/app/dashboard/admin/tickets/TicketWindow.tsx', 'utf8');
const tags = content.match(/<([A-Z][a-zA-Z0-9]*)/g) || [];
const tagNames = [...new Set(tags.map(t => t.slice(1)))];

const importsMatched = content.match(/import\s*\{\s*([^}]+)\}\s*from\s*['\"]lucide-react['\"]/);
const iconNames = importsMatched ? importsMatched[1].split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

console.log('--- TAGS FOUND ---');
console.log(tagNames.sort().join('\n'));
console.log('\n--- ICONS IMPORTED ---');
console.log(iconNames.sort().join('\n'));

const missing = tagNames.filter(t => !['TicketStateNavigator', 'InfoBarBase', 'DiagnosisInfoBar', 'QuoteAssistantBar', 'QuotationInfoBar', 'FinancialLiquidationBar', 'PaymentHistoryBar', 'UnifiedEvidenceBar', 'DocumentationSummaryBar', 'TicketSummary', 'GestoraAssignmentBar', 'TicketHistoryTimeline', 'TicketGeneralFiles', 'TicketChat', 'TicketAuditLog'].includes(t) && !iconNames.includes(t));

console.log('\n--- POTENTIALLY MISSING ---');
console.log(missing.join('\n'));
