// ── PDF ──
async function downloadPDF() {
  await document.fonts.ready;
  window.print();
}

// ── 이미지 저장 (고화질 PNG) ──
async function downloadJPG() {
  const btn = document.getElementById('jpgBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 변환 중…';

  const page = document.getElementById('a4page');
  const wasJpg = currentViewMode === 'jpg';
  if (!wasJpg) setViewMode('jpg');

  await new Promise(r => setTimeout(r, 150));

  try {
    await document.fonts.ready;
    const rect = page.getBoundingClientRect();

    // 화면 픽셀비 × 8배 — DOM 크기 고정, 스케일만 극대화
    const SCALE = window.devicePixelRatio * 8;

    const canvas = await html2canvas(page, {
      scale:           SCALE,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#ffffff',
      logging:         false,
      removeContainer: true,
      width:           rect.width,
      height:          rect.height,
      onclone: (doc) => {
        doc.querySelectorAll('.add-cell-btn, .badge-del')
           .forEach(el => el.style.visibility = 'hidden');
      }
    });

    // 그대로 PNG로 저장 (리사이즈 없음 = 최고 화질)
    const dataURL = canvas.toDataURL('image/png');

    const branch    = BRANCHES[currentBranch];
    const clsName   = CLASSES[currentClassIdx].name.replace(/\s+/g, '');
    const rawLabel  = document.getElementById('pageLabel').textContent.trim();
    const pageLabel = rawLabel.replace(/\s*\+\s*/g, '+').replace(/\s+/g, '');

    const a = document.createElement('a');
    a.href     = dataURL;
    a.download = `${YEAR}_${branch}_${clsName}_${pageLabel}.png`;
    a.click();

  } catch(e) {
    alert('이미지 변환 중 오류가 발생했습니다: ' + e.message);
    console.error(e);
  } finally {
    if (!wasJpg) setViewMode('pdf');
    btn.disabled    = false;
    btn.textContent = '⬇ 이미지 저장';
  }
}

