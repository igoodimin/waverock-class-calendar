/* 순수 날짜 함수: 추후 주차 이동 기능은 moveDate / weeklyDates를 재사용합니다. */
const CalendarDates = (() => {
  const format = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function parse(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('날짜를 확인하세요.');
    const [y,m,d] = value.split('-').map(Number);
    const date = new Date(y,m-1,d);
    if (y < 1900 || y > 2100 || format(date) !== value) throw new Error('날짜는 1900–2100년의 유효한 날짜여야 합니다.');
    return date;
  }
  function moveDate(value, days) {
    const date = parse(value);
    date.setDate(date.getDate()+days);
    return format(date);
  }
  function weeklyDates(value) {
    const date = parse(value), y=date.getFullYear(), m=date.getMonth(), result=[];
    for (let d=1; d<=new Date(y,m+1,0).getDate(); d++) {
      const current=new Date(y,m,d);
      if (current.getDay()===date.getDay()) result.push(format(current));
    }
    return result;
  }
  function layout(year, month) {
    const firstDay = new Date(year,month,1).getDay();
    // 2026년 원본 출력과 동일한 예외. 다른 연도에는 빈 주말 행을 만들지 않습니다.
    const skipSaturday = firstDay===6 && (year!==2026 || month===7);
    const offset=skipSaturday ? 2 : firstDay===0 ? 1 : firstDay===1 ? 0 : -(firstDay-1);
    const gridStart = new Date(year,month,1+offset);
    const showNovemberFirstWeek=year===2026 && month===9;
    const last=new Date(year,month+1,0);
    while (last.getDay()===0 || last.getDay()===6) last.setDate(last.getDate()-1);
    const required=Math.floor((last-gridStart)/86400000/7)+1;
    return {gridStart,totalWeeks:showNovemberFirstWeek?6:Math.max(5,required),showNovemberFirstWeek};
  }
  return { format, parse, moveDate, weeklyDates, layout };
})();
if (typeof module !== 'undefined') module.exports = CalendarDates;
