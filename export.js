// CSV export for Pam's Farm Time Clock

function fmt24(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}
function fmtDate(d) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}
function fmtShort(d) {
  return `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;
}
function decHours(ms) { return (ms / 3600000).toFixed(2); }
function getDayKey(d) {
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

export function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23,59,59,999);
  return d;
}

export function getWeekLabel(weekStart) {
  return `${fmtShort(new Date(weekStart))} - ${fmtShort(getWeekEnd(new Date(weekStart)))}`;
}

export function generateCSV(userName, weekStart, entries) {
  const ws = new Date(weekStart);
  const we = getWeekEnd(ws);
  const lines = [];

  lines.push(`"Pam's Farm Time Clock"`);
  lines.push(`"Employee: ${userName}"`);
  lines.push(`"Week of: ${fmtShort(ws)} - ${fmtShort(we)}"`);
  lines.push('');
  lines.push('"Date","Clock In","Clock Out","Hours","Notes"');

  let weekTotalMs = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(ws);
    day.setDate(ws.getDate() + i);
    const key = getDayKey(day);
    const dayEntries = entries.filter(e => getDayKey(new Date(e.clockIn)) === key);
    if (!dayEntries.length) continue;

    let dayTotalMs = 0;
    for (const e of dayEntries) {
      const dur = (e.clockOut && e.clockIn) ? e.clockOut - e.clockIn : 0;
      dayTotalMs += dur;
      lines.push(`"${fmtDate(day)}","${fmt24(e.clockIn)}","${e.clockOut ? fmt24(e.clockOut) : 'In Progress'}","${e.clockOut ? decHours(dur) : ''}","${e.notes || ''}"`);
    }
    weekTotalMs += dayTotalMs;
    lines.push(`"${fmtDate(day)} Total","","","${decHours(dayTotalMs)} hrs",""`);
    lines.push('');
  }
  lines.push(`"Weekly Total","","","${decHours(weekTotalMs)} hrs",""`);
  return lines.join('\r\n');
}

export async function exportAndShare(userName, weekStart, entries) {
  const csv = generateCSV(userName, weekStart, entries);
  const label = getWeekLabel(weekStart).replace(/\//g, '-');
  const fileName = `PamsFarm_Timesheet_${label}.csv`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const file = new File([blob], fileName, { type: 'text/csv' });

  // Try Web Share API with file (iOS 15+, modern Android)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: `Timesheet – ${getWeekLabel(weekStart)}`,
    });
    return;
  }

  // Fallback: download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
