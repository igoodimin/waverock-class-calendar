/* 관리 UI / 저장 흐름. 출력 레이아웃은 calendar-view.js와 calendar.css에 격리합니다. */
let YEAR = 2026;
let CLASSES = DEFAULT_CLASSES.map(c=>({...c,active:true}));
let currentClassIdx=0, currentBranch=0, currentPage=1;
let allLessonsPerBranch=[], allLessons=[];
let records={courses:[],lessons:[]}, store, ready=false, busy=false;
let modalContext=null, courseSnapshot=null, refreshTask=null, refreshAgain=false;
const $=id=>document.getElementById(id);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(text,state='') { $('syncStatus').textContent=text; $('syncStatus').dataset.state=state; }
function normalStatus() { status(store.demo?'로컬 데모 · 이 브라우저에만 저장됩니다. 공동 저장은 config.js 설정 후 사용할 수 있습니다.':'공동 저장 연결됨 · 다른 사용자의 변경을 자동 반영합니다.','ready'); }
function canEdit() {
  if(!ready || busy) { if(!ready) alert('데이터를 먼저 불러와 주세요.'); return false; }
  if(!CLASSES[currentClassIdx]?.active) { alert('활성 강습을 선택하세요.'); return false; }
  return true;
}
function updateTimestamp(date) {
  $('lastUpdated').textContent=date?new Date(date).toLocaleString('ko-KR',{hour12:false}):'—';
}
function projectRecords() {
  const selected=CLASSES[currentClassIdx]?.id;
  CLASSES=records.courses.toSorted((a,b)=>a.position-b.position || a.id.localeCompare(b.id));
  if(!CLASSES.length) throw new Error('강습 정보가 없습니다. Supabase 설정 SQL을 실행하세요.');
  currentClassIdx=CLASSES.findIndex(c=>c.id===selected && c.active);
  if(currentClassIdx<0) currentClassIdx=CLASSES.findIndex(c=>c.active);
  if(currentClassIdx<0) throw new Error('활성 강습이 없습니다.');
  allLessonsPerBranch=BRANCHES.map(()=>CLASSES.map(()=>Object.fromEntries(Array.from({length:12},(_,m)=>[m,{}]))));
  const indices=new Map(CLASSES.map((c,i)=>[c.id,i]));
  for(const row of records.lessons) {
    const ci=indices.get(row.course_id);
    if(ci===undefined || !allLessonsPerBranch[row.branch_id]) continue;
    const m=Number(row.lesson_date.slice(5,7))-1;
    const days=allLessonsPerBranch[row.branch_id][ci][m];
    (days[row.lesson_date] ||= []).push({label:row.label,start:row.start_time.slice(0,5),end:row.end_time.slice(0,5),color:row.color,record:row});
  }
  for(const branch of allLessonsPerBranch) for(const course of branch) for(const month of Object.values(course)) for(const lessons of Object.values(month)) lessons.sort((a,b)=>a.start.localeCompare(b.start)||a.record.id.localeCompare(b.record.id));
  allLessons=allLessonsPerBranch[currentBranch];
  renderTabs(); applyTheme(); renderAll();
  const timestamps=records.lessons.filter(l=>l.branch_id===currentBranch).map(l=>l.updated_at).filter(Boolean).sort();
  updateTimestamp(timestamps.at(-1));
}
function renderTabs() {
  const root=document.querySelector('.class-tabs'); root.replaceChildren();
  CLASSES.forEach((course,i)=>{
    if(!course.active) return;
    const button=document.createElement('button');
    button.id=`ctab-${i}`; button.className='class-tab'+(i===currentClassIdx?' active':'');
    button.textContent=course.name; button.onclick=()=>switchClass(i);
    if(i===currentClassIdx) {button.style.background=course.theme;button.style.color='#fff';button.style.borderColor=course.theme;}
    root.append(button);
  });
}
function switchClass(i) { if(!CLASSES[i]?.active) return; currentClassIdx=i;renderTabs();applyTheme();renderAll(); }
function switchBranch(i) {
  currentBranch=i; allLessons=allLessonsPerBranch[i];
  BRANCHES.forEach((_,n)=>$('bbtn-'+n).classList.toggle('active',n===i));
  projectRecords();
}
function changeYear(value) {
  const year=Number(value);
  if(!Number.isInteger(year)||year<1900||year>2100) {alert('1900–2100년을 입력하세요.');$('yearInput').value=YEAR;return;}
  YEAR=year; renderAll();
}
async function refreshCalendar(quiet=false) {
  if(!store) return;
  if(refreshTask) {refreshAgain=true;return refreshTask;}
  refreshTask=(async()=>{
    do {
      refreshAgain=false;
      try {
        const fresh=await store.load();
        records=fresh; projectRecords();ready=true;
        if(!busy) normalStatus();
      } catch(error) {
        status('불러오기 실패 · '+error.message+' · 새로고침으로 다시 시도하세요.','error');
        if(!quiet) alert('불러오기 실패: '+error.message);
        return false;
      }
    } while(refreshAgain);
    return true;
  })();
  try {return await refreshTask;} finally {refreshTask=null;}
}
async function commit(action,onSuccess) {
  if(busy) return;
  busy=true; status('저장 중…');
  $('modalConfirmBtn').disabled=$('modalDeleteBtn').disabled=$('courseSave').disabled=true;
  try {
    await action();
    onSuccess?.();
    const refreshed=await refreshCalendar(true);
    if(refreshed) {
      normalStatus();
      $('saveToast').classList.add('show');setTimeout(()=>$('saveToast').classList.remove('show'),1800);
    } else status('저장은 완료됐지만 화면 갱신에 실패했습니다. 새로고침해 주세요.','error');
  } catch(error) {
    const conflict=/conflict|다른 편집|변경되었습니다/i.test(error.message);
    const message=conflict?'다른 사용자가 먼저 수정했습니다. 입력은 유지했습니다. 내용을 복사한 뒤 창을 닫고 새로고침하여 다시 편집하세요.':error.message;
    status('저장 실패 · '+message,'error');alert(message);
  } finally {
    busy=false;$('modalConfirmBtn').disabled=$('modalDeleteBtn').disabled=$('courseSave').disabled=false;
  }
}
// 모달이 열려 있는 동안 원격 갱신이 와도 편집 대상과 버전은 그대로 유지합니다.
const baseOpenModal=openModal;
openModal=function(date) {
  if(!canEdit()) return;
  modalContext={course_id:CLASSES[currentClassIdx].id,branch_id:currentBranch,theme:CLASSES[currentClassIdx].theme,mono:CLASSES[currentClassIdx].mono};
  baseOpenModal(date);
};
const baseOpenEditModal=openEditModal;
openEditModal=function(date,idx,event) {
  if(!canEdit()) return;
  modalContext={course_id:CLASSES[currentClassIdx].id,branch_id:currentBranch,theme:CLASSES[currentClassIdx].theme,mono:CLASSES[currentClassIdx].mono};
  baseOpenEditModal(date,idx,event);
};
function confirmLesson() {
  if(!modalContext || busy) return;
  try {
    const date=$('inputDate').value, parsed=CalendarDates.parse(date);
    if([0,6].includes(parsed.getDay())) throw new Error('출력 달력은 월–금만 표시합니다. 평일을 선택하세요.');
    const start=$('inputStart').value,end=$('inputEnd').value,label=$('inputLabel').value.trim()||'강습';
    if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||end<=start) throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.');
    if(label.length>80) throw new Error('회차명은 80자 이하로 입력하세요.');
    const palette=makeMonoPalette(modalContext.theme);
    const color=modalContext.mono?palette[Number(selectedMonoColor.replace('mono',''))-1]||palette[0]:selectedColor;
    const dates=editState?[date]:$('applyWeekly').checked?CalendarDates.weeklyDates(date):[date];
    const old=editState?.record;
    const changes=dates.map(day=>({id:old?.id||crypto.randomUUID(),expected:old?.revision||0,data:{course_id:modalContext.course_id,branch_id:modalContext.branch_id,lesson_date:day,label,start_time:start,end_time:end,color}}));
    commit(()=>store.saveLessons(changes),()=>{closeModal();YEAR=parsed.getFullYear();$('yearInput').value=YEAR;currentPage=Math.min(parsed.getMonth(),10);});
  } catch(error) {alert(error.message);}
}
function deleteFromModal() {
  if(!editState||busy) return;
  const row=editState.record;
  if(confirm('이 일정을 삭제할까요?')) commit(()=>store.saveLessons([{id:row.id,expected:row.revision,data:null}]),closeModal);
}
function deleteLesson(date,idx) {
  if(!canEdit()) return;
  const row=allLessons[currentClassIdx][Number(date.slice(5,7))-1][date][idx].record;
  if(confirm('이 일정을 삭제할까요?')) commit(()=>store.saveLessons([{id:row.id,expected:row.revision,data:null}]));
}
function openCourseManager() {
  if(!canEdit()) return;
  const select=$('courseSelect'); select.replaceChildren(new Option('＋ 새 강습 종류','new'));
  for(const c of CLASSES) select.add(new Option(c.name+(c.active?'':' (비활성)'),c.id));
  select.value=CLASSES[currentClassIdx].id;selectCourse(select.value);$('courseDialog').showModal();
}
function selectCourse(id) {
  courseSnapshot=structuredClone(records.courses.find(c=>c.id===id)||{id:crypto.randomUUID(),name:'',theme:'#ff7700',mono:true,active:true,position:Math.max(0,...records.courses.map(c=>c.position))+1,revision:0});
  $('courseName').value=courseSnapshot.name;$('courseTheme').value=courseSnapshot.theme;
  $('courseMono').checked=courseSnapshot.mono;$('courseActive').checked=courseSnapshot.active;
}
$('courseForm').addEventListener('submit',e=>{
  e.preventDefault();if(!courseSnapshot||busy) return;
  const name=$('courseName').value.trim();if(!name) return;
  const data={id:courseSnapshot.id,name,theme:$('courseTheme').value,mono:$('courseMono').checked,active:$('courseActive').checked,position:courseSnapshot.position};
  commit(()=>store.saveCourse(data,courseSnapshot.revision),()=>$('courseDialog').close());
});
(async()=>{
  try {
    store=new CalendarStore(window.CALENDAR_CONFIG,DEFAULT_CLASSES);
    await refreshCalendar(true);setViewMode('pdf');
    store.subscribe(()=>refreshCalendar(true),s=>{
      if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s)) status('실시간 연결 재시도 중 · 15초 간격으로 변경을 확인합니다.');
    });
    // 재접속·백그라운드 복귀 시 빠진 이벤트를 보완합니다.
    setInterval(()=>{if(!document.hidden&&!busy) refreshCalendar(true);},15000);
    window.addEventListener('online',()=>refreshCalendar(true));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden) refreshCalendar(true);});
  } catch(error) {status(error.message,'error');}
})();
