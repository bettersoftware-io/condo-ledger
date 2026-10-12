// Names that are also ordinary text: an Italian word, a place, a brand, or a
// saint that names towns and streets. A history-wide rewrite must not replace
// them on their own ("Piano dei Conti", "Gentile Signora", "San Daniele"), so
// the mapping export rewrites such a name only inside a full name. A general
// stop-list of common Italian surnames of that kind; lower case.
export const COMMON_WORDS: ReadonlySet<string> = new Set([
  // Italian words (nouns, adjectives, participles)
  "barbieri", // barbers
  "colombo", // dove
  "costa", // coast
  "fabbri", // smiths
  "ferri", // irons
  "fiore", // flower
  "fontana", // fountain
  "galli", // roosters
  "gatti", // cats
  "greco", // Greek
  "leone", // lion
  "marino", // marine
  "martini", // the vermouth
  "monti", // mountains
  "porta", // door
  "russo", // Russian
  "sartori", // tailors
  "serra", // greenhouse
  "villa", // villa
  "bianchi", // whites (and a bicycle brand)
  "castelli", // castles
  "conti", // accounts, counts
  "donato", // donated
  "franco", // frank, the franc
  "gentile", // kind; the salutation
  "grassi", // fat (plural)
  "guerra", // war
  "lombardi", // Lombards
  "lupini", // lupin beans
  "mancini", // left-handed (plural)
  "massimo", // maximum
  "pellegrini", // pilgrims
  "pelosi", // hairy (plural)
  "pistone", // piston
  "rossi", // reds
  "ventura", // fortune
  "vitale", // vital
  // Places
  "doria", // Andrea Doria: streets, a ship
  "giordano", // the river Jordan
  "harris", // the Isle of Harris
  "madras", // the city
  "messina", // the city
  // Brands and famous names used as words
  "alice", // a telecom brand
  "bellini", // the cocktail, the composer
  "caruso", // the tenor
  "ferrari", // the car maker
  "heinz", // the food brand
  "morellato", // the watch brand
  "moretti", // the beer brand
  // Saints that name towns, churches and streets ("San Daniele del Friuli")
  "andrea",
  "daniele",
  "giorgio",
  "giovanni",
  "giuseppe",
  "lucia",
  "maria",
  "michele",
  "paolo",
  "stefano",
]);
