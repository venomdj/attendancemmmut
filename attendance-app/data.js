// ===== Source of truth: subjects =====
const SUBJECTS = {
  "BSM-110": { code:"BSM-110", name:"Engineering Mathematics-I", color:"#eab308" },
  "BSM-131": { code:"BSM-131", name:"Engineering Physics",       color:"#f97316" },
  "BIT-103": { code:"BIT-103", name:"Programming in C",          color:"#22c55e" },
  "BME-101": { code:"BME-101", name:"Manufacturing Techniques Workshop", color:"#38bdf8" },
  "BHS-101": { code:"BHS-101", name:"Universal Human Values",    color:"#a855f7" },
};

// day: 0=Sun..6=Sat. Times in 24h "HH:MM". type: lecture|practical|tutorial
const TIMETABLE = [
  { id:"mon-1", day:1, start:"10:00", end:"10:50", subject:"BSM-131", type:"lecture",   room:"TL-110" },
  { id:"mon-2", day:1, start:"10:50", end:"11:40", subject:"BSM-110", type:"lecture",   room:"TL-110", faculty:"VB" },

  { id:"tue-1", day:2, start:"10:00", end:"10:50", subject:"BSM-131", type:"lecture",   room:"TL-110" },
  { id:"tue-2", day:2, start:"10:50", end:"11:40", subject:"BSM-110", type:"lecture",   room:"TL-110" },
  { id:"tue-3", day:2, start:"14:00", end:"15:30", subject:"BSM-131", type:"practical", room:"TL-110", batch:"P1" },
  { id:"tue-4", day:2, start:"15:30", end:"16:15", subject:"BSM-110", type:"tutorial",  room:"TL-110", batch:"T1", faculty:"AG" },

  { id:"wed-1", day:3, start:"09:10", end:"12:30", subject:"BME-101", type:"practical", room:"BME-104", batch:"P1" },

  { id:"thu-1", day:4, start:"10:00", end:"10:50", subject:"BSM-131", type:"lecture",   room:"TL-110" },
  { id:"thu-2", day:4, start:"10:50", end:"11:40", subject:"BHS-101", type:"lecture",   room:"TL-110" },
  { id:"thu-3", day:4, start:"11:40", end:"12:30", subject:"BIT-103", type:"lecture",   room:"TL-110", faculty:"AKG" },

  { id:"fri-1", day:5, start:"09:10", end:"10:00", subject:"BSM-110", type:"lecture",   room:"TL-110", faculty:"VB" },
  { id:"fri-2", day:5, start:"10:00", end:"10:50", subject:"BHS-101", type:"lecture",   room:"TL-110" },
  { id:"fri-3", day:5, start:"10:50", end:"11:40", subject:"BIT-103", type:"lecture",   room:"TL-110", faculty:"AKG" },
  { id:"fri-4", day:5, start:"14:00", end:"14:45", subject:"BME-101", type:"lecture",   room:"TL-110" },

  { id:"sat-1", day:6, start:"09:10", end:"10:00", subject:"BIT-103", type:"practical", room:"ITRC-01", batch:"P1" },
  { id:"sat-2", day:6, start:"10:00", end:"10:50", subject:"BME-101", type:"lecture",   room:"TL-110" },
  { id:"sat-3", day:6, start:"10:50", end:"11:40", subject:"BHS-101", type:"lecture",   room:"TL-110" },
];

const DEFAULT_THRESHOLD = 75;
const SEMESTER_WEEKS = 16;
