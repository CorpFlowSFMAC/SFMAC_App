
const fs = require('fs');
const path = 'c:/CorpFlowSFMAC/src/app/dashboard/admin/tickets/TicketSummary.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /const st = \(p\.estado_pago \|\| p\.estado \|\| 'borrador'\)\.toLowerCase\(\);/g;

if (regex.test(content)) {
    // Only remove the ONE inside the IIFE (line 1519 approx)
    // Actually there might be two.
    // One at line 1481 (keep this one)
    // One at line 1519 (remove this one)
    
    const lines = content.split('\n');
    let count = 0;
    const newLines = lines.filter(line => {
        if (line.includes("const st = (p.estado_pago || p.estado || 'borrador').toLowerCase();")) {
            count++;
            if (count === 2) return false; // Remove the second occurrence
        }
        return true;
    });
    
    fs.writeFileSync(path, newLines.join('\n'));
    console.log(`Success: removed second occurrence. Found ${count}`);
} else {
    console.log("Target not found with regex");
}
