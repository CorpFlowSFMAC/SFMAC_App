const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) {
        console.log('Not found: ' + filePath);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (const [regex, replacement] of replacements) {
        content = content.replace(regex, replacement);
    }
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated ' + filePath);
    } else {
        console.log('No changes in ' + filePath);
    }
}

const dir = 'C:/Users/ang_0/.gemini/antigravity-ide/scratch/SFMAC_App/src';

replaceInFile(path.join(dir, 'app/dashboard/admin/technicians/TechnicianDrawer.tsx'), [
    [/formData\.zonas(?!\w)/g, 'formData.zonas_asignadas'],
    [/zonas: \[\] as string\[\]/g, 'zonas_asignadas: [] as string[]'],
    [/zonas: existingZonas/g, 'zonas_asignadas: existingZonas'],
    [/zonas: \[\]/g, 'zonas_asignadas: []'],
    [/zonas: /g, 'zonas_asignadas: '],
    [/formData\.agenciasAsignadas/g, 'formData.agencias_asignadas'],
    [/agenciasAsignadas:/g, 'agencias_asignadas:'],
    [/_agenciasAsignadas:/g, 'agencias_asignadas:']
]);

replaceInFile(path.join(dir, 'app/dashboard/admin/tickets/TicketWindow.tsx'), [
    [/newTechnicianId/g, 'tecnico_id'],
    [/technician_id/g, 'tecnico_id'],
    [/action=patch/g, 'accion=parchar_ticket'],
    [/tecnicoAsignado/g, 'tecnico'],
    [/agenciasAsignadas/g, 'agencias_asignadas']
]);

replaceInFile(path.join(dir, 'app/api/v3/technicians-server/route.ts'), [
    [/action === 'sync_branches'/g, "accion === 'sincronizar_agencias'"],
    [/action === "sync_branches"/g, 'accion === "sincronizar_agencias"'],
    [/action=/g, 'accion='],
    [/const action = /g, 'const accion = '],
    [/sync_branches/g, 'sincronizar_agencias'],
    [/agenciasAsignadas/g, 'agencias_asignadas'],
    [/_agenciasAsignadas/g, 'agencias_asignadas'],
    [/technician_id/g, 'tecnico_id']
]);

replaceInFile(path.join(dir, 'app/api/v3/tickets-server/route.ts'), [
    [/action === 'patch'/g, "accion === 'parchar_ticket'"],
    [/action === "patch"/g, 'accion === "parchar_ticket"'],
    [/const action = /g, 'const accion = '],
    [/action=/g, 'accion='],
    [/technician_id/g, 'tecnico_id'],
    [/newTechnicianId/g, 'tecnico_id']
]);
