"use client";

interface TimelineEvent {
  year: string;
  title: string;
  description: string;
  type: "founding" | "milestone" | "product" | "crisis" | "expansion";
}

interface BusinessTimelineProps {
  events: TimelineEvent[];
}

const TYPE_STYLE = {
  founding: "bg-chart-1",
  milestone: "bg-chart-3",
  product: "bg-chart-4",
  crisis: "bg-chart-2",
  expansion: "bg-chart-5",
};

const TYPE_LABEL = {
  founding: "설립",
  milestone: "주요 성과",
  product: "제품/서비스",
  crisis: "위기/전환",
  expansion: "확장",
};

export function BusinessTimeline({ events }: BusinessTimelineProps) {
  return (
    <div className="relative">
      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mb-6">
        {Object.entries(TYPE_LABEL).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${TYPE_STYLE[key as keyof typeof TYPE_STYLE]}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* 타임라인 */}
      <div className="relative pl-6 border-l-2 border-muted space-y-6">
        {events.map((event, index) => (
          <div key={index} className="relative">
            {/* 도트 */}
            <div
              className={`absolute -left-[25px] top-1 h-4 w-4 rounded-full border-2 border-background ${
                TYPE_STYLE[event.type]
              }`}
            />

            {/* 콘텐츠 */}
            <div className="rounded-xl border bg-card p-4 hover:shadow-toss-sm transition-shadow">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-sm font-bold text-primary tabular-nums">{event.year}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${TYPE_STYLE[event.type]}`}>
                  {TYPE_LABEL[event.type]}
                </span>
              </div>
              <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {event.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 삼성전자 타임라인 프리셋
export function getSamsungTimeline(): TimelineEvent[] {
  return [
    {
      year: "1969",
      title: "삼성전자 설립",
      description: "이병철 회장이 삼성전자공업(주)를 설립. 초기에는 흑백 TV, 세탁기, 냉장고 등 가전제품을 주로 생산했습니다. 일본 산요(Sanyo)와 기술 제휴를 통해 전자 산업에 첫 발을 내딛었습니다.",
      type: "founding",
    },
    {
      year: "1983",
      title: "반도체 사업 진출 (도쿄 선언)",
      description: "이병철 회장이 도쿄에서 반도체 사업 진출을 선언합니다. 당시 많은 전문가들이 \"무모하다\"고 평가했으나, 이 결정이 오늘날 삼성전자의 핵심 경쟁력이 되었습니다. 64Kb DRAM 개발에 성공하며 반도체 시장에 진입합니다.",
      type: "milestone",
    },
    {
      year: "1992",
      title: "세계 최초 64Mb DRAM 개발, 메모리 1위",
      description: "세계 최초로 64Mb DRAM을 개발하며 일본 기업들을 제치고 메모리 반도체 세계 1위에 올랐습니다. 이후 30년 넘게 1위 자리를 유지하고 있습니다. 한국 반도체 산업의 상징적 사건입니다.",
      type: "milestone",
    },
    {
      year: "1993",
      title: "이건희 회장 '신경영' 선언",
      description: "\"마누라와 자식 빼고 다 바꿔라\" — 이건희 회장의 프랑크푸르트 선언으로 삼성의 기업 문화가 근본적으로 변화합니다. 품질 경영을 최우선 가치로 삼으며, 글로벌 브랜드로의 도약을 시작합니다.",
      type: "crisis",
    },
    {
      year: "2007",
      title: "TV 세계 1위 달성",
      description: "LCD TV 시장에서 소니를 제치고 세계 1위를 차지합니다. 이후 2026년 현재까지 19년 연속 세계 1위를 유지하고 있으며, QLED/OLED 등 프리미엄 시장도 선도하고 있습니다.",
      type: "milestone",
    },
    {
      year: "2009",
      title: "갤럭시 시리즈 출시",
      description: "안드로이드 기반 갤럭시 S 시리즈를 출시하며 스마트폰 시장에 본격 진입합니다. 이후 애플 아이폰과 함께 글로벌 스마트폰 시장을 양분하는 구도를 형성했습니다.",
      type: "product",
    },
    {
      year: "2017",
      title: "시가총액 300조원 돌파, 반도체 슈퍼사이클",
      description: "서버/클라우드 수요 폭발로 메모리 반도체 가격이 급등하며 반도체 슈퍼사이클이 도래합니다. 연간 영업이익 50조원 시대를 열었습니다.",
      type: "milestone",
    },
    {
      year: "2019",
      title: "폴더블 스마트폰 갤럭시 Z 출시",
      description: "세계 최초 폴더블 스마트폰 갤럭시 폴드를 출시하며 스마트폰의 새로운 폼팩터를 개척합니다. 2026년 현재 폴더블 스마트폰 시장 점유율 약 75%로 압도적 1위입니다.",
      type: "product",
    },
    {
      year: "2023",
      title: "반도체 다운사이클, 영업이익 급감",
      description: "메모리 반도체 가격 하락으로 DS부문이 적자를 기록하며 전사 영업이익이 6.6조원으로 급감합니다 (전년 43.4조원). 반도체 산업의 사이클 특성이 극명하게 드러난 해입니다.",
      type: "crisis",
    },
    {
      year: "2024~",
      title: "AI 반도체(HBM) 시대, 재도약 시도",
      description: "ChatGPT 등 AI 서비스 폭발적 성장으로 고대역폭 메모리(HBM) 수요가 급증합니다. SK하이닉스가 선점한 HBM 시장에서 빠르게 추격 중이며, 파운드리 2nm 공정 양산도 준비하고 있습니다. 삼성전자의 차세대 성장 동력이 될 핵심 전장입니다.",
      type: "expansion",
    },
  ];
}
