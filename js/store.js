/* Supabase 접근만 담당합니다. UI나 달력 배치에 의존하지 않습니다. */
class CalendarStore {
  constructor(config, defaults) {
    this.demo = !config.supabaseUrl && !config.supabaseKey;
    this.demoKey = 'waverock-calendar-demo-v1';
    if (!this.demo) {
      if (!config.supabaseUrl || !config.supabaseKey) throw new Error('config.js의 URL과 공개 키를 모두 입력하세요.');
      if (!window.supabase) throw new Error('Supabase 라이브러리를 불러오지 못했습니다. 네트워크를 확인하세요.');
      this.client=window.supabase.createClient(config.supabaseUrl,config.supabaseKey);
    }
    this.defaults=defaults;
  }
  demoState() {
    const saved=localStorage.getItem(this.demoKey);
    return saved ? JSON.parse(saved) : {
      courses:this.defaults.map((c,i)=>({...c,id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,active:true,position:i,revision:1})),
      lessons:[]
    };
  }
  async all(table) {
    const rows=[];
    for(let from=0;;from+=500) {
      const {data,error}=await this.client.from(table).select('*').order('id').range(from,from+499);
      if(error) throw error;
      rows.push(...data);
      if(data.length<500) return rows;
    }
  }
  async load() {
    if(this.demo) return this.demoState();
    const [courses,lessons]=await Promise.all([this.all('calendar_courses'),this.all('calendar_lessons')]);
    return {courses,lessons};
  }
  async saveLessons(changes) {
    if(this.demo) {
      // 데모는 단일 브라우저 확인용입니다. 공동 편집은 Supabase에서만 보장합니다.
      const state=this.demoState();
      for(const change of changes) {
        const i=state.lessons.findIndex(l=>l.id===change.id);
        const old=state.lessons[i];
        if(change.expected===0 ? !!old : !old || old.revision!==change.expected) throw new Error('다른 편집으로 내용이 바뀌었습니다. 새로고침 후 다시 편집하세요.');
        if(change.data===null) state.lessons.splice(i,1);
        else {
          const course=state.courses.find(c=>c.id===change.data.course_id);
          if(!course?.active) throw new Error('비활성 강습에는 저장할 수 없습니다.');
          const row={...change.data,id:change.id,revision:(old?.revision||0)+1,updated_at:new Date().toISOString()};
          if(i<0) state.lessons.push(row); else state.lessons[i]=row;
        }
      }
      localStorage.setItem(this.demoKey,JSON.stringify(state));
      return;
    }
    const {error}=await this.client.rpc('calendar_save_lessons',{changes});
    if(error) throw error;
  }
  async saveCourse(data, expected) {
    if(this.demo) {
      const state=this.demoState(), i=state.courses.findIndex(c=>c.id===data.id),old=state.courses[i];
      if(expected===0 ? !!old : !old || old.revision!==expected) throw new Error('강습 정보가 변경되었습니다. 다시 열어 주세요.');
      if(!data.active && !state.courses.some(c=>c.id!==data.id&&c.active)) throw new Error('활성 강습을 하나 이상 유지하세요.');
      const row={...data,revision:(old?.revision||0)+1,updated_at:new Date().toISOString()};
      if(i<0) state.courses.push(row); else state.courses[i]=row;
      localStorage.setItem(this.demoKey,JSON.stringify(state));
      return;
    }
    const {error}=await this.client.rpc('calendar_save_course',{course:data,expected});
    if(error) throw error;
  }
  subscribe(onChange, onStatus) {
    if(this.demo) {
      window.addEventListener('storage',e=>{if(e.key===this.demoKey) onChange();});
      return;
    }
    this.channel=this.client.channel('calendar-updates')
      .on('postgres_changes',{event:'*',schema:'public',table:'calendar_lessons'},onChange)
      .on('postgres_changes',{event:'*',schema:'public',table:'calendar_courses'},onChange)
      .subscribe(status=>{
        onStatus(status);
        if(status==='SUBSCRIBED') onChange();
      });
  }
}
