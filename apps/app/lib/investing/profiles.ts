/**
 * What each company in the curated universe actually does, in a sentence.
 *
 * WRITTEN BY US, NOT FILED
 * -----------------------
 * These are editorial, unlike everything in lib/investing/fundamentals.ts,
 * which is derived from filings. The SEC publishes no business description in
 * structured form: the real one lives in Item 1 of the 10-K as pages of prose,
 * and there is no free feed that turns it into a paragraph. So this is a hand
 * written list, and it is honest about being one - the app labels the section
 * as FinnaCalc's own description rather than presenting it as filed data.
 *
 * RULES FOR ADDING TO IT, WHICH ARE THE REASON IT IS SAFE
 * ------------------------------------------------------
 * 1. NO FIGURES. No revenue, no headcount, no market position, no "largest".
 *    A sentence with a number in it is wrong within a year and nobody comes
 *    back to fix it. Every line here says what a company does, which changes
 *    on the scale of a decade.
 * 2. No opinion, no outlook, no adjectives that read as a recommendation.
 *    "Designs and sells smartphones" is a fact; "dominates smartphones" is a
 *    view, and this app does not offer views on securities.
 * 3. Headquarters is the operating headquarters, city and state. Stable, and
 *    checkable against the cover of any 10-K.
 *
 * WHY THERE IS NO EMPLOYEE COUNT
 * ------------------------------
 * It was asked for and it is not here on purpose. Employee counts are not in
 * SEC structured data: `dei` carries exactly two facts per filer, the
 * cover-page share count and the public float. The number lives in the 10-K's
 * text. Hand-entering it would mean typing a real, checkable figure that goes
 * stale every February, which is precisely the kind of number this app does
 * not print. If a real source turns up, add `employees` here and the About
 * row is already waiting for it.
 *
 * COVERAGE
 * --------
 * The same 105 large caps SECTOR_UNIVERSE covers. Anything else returns null
 * and the About section falls back to the facts it does have. That is the same
 * bargain the sector list already makes.
 */

export type SymbolAbout = {
    /** One or two sentences. See the rules above before editing. */
    description: string
    /** Operating headquarters, "City, ST". */
    headquarters: string
}

export const SYMBOL_ABOUT: Record<string, SymbolAbout> = {
    // Technology
    AAPL: { description: "Apple designs and sells consumer electronics and the software that runs on them, including the iPhone, iPad, Mac and Apple Watch, alongside services such as the App Store, iCloud and Apple Music.", headquarters: "Cupertino, CA" },
    MSFT: { description: "Microsoft makes software, cloud infrastructure and devices. Its main businesses are the Azure cloud platform, the Windows operating system, the Office and Microsoft 365 productivity suite, and the Xbox gaming brand.", headquarters: "Redmond, WA" },
    NVDA: { description: "NVIDIA designs graphics and AI processors. Its chips are used for video game graphics, professional visualisation, data-centre computing and machine learning, and it also builds the CUDA software platform developers use to program them.", headquarters: "Santa Clara, CA" },
    GOOGL: { description: "Alphabet is the parent of Google. Its businesses include Google Search, YouTube, the Android operating system, the Chrome browser, Google Cloud, and a set of smaller ventures it calls Other Bets, such as Waymo.", headquarters: "Mountain View, CA" },
    META: { description: "Meta Platforms runs Facebook, Instagram, WhatsApp and Messenger, and earns most of its money selling advertising across them. It also builds Quest virtual-reality headsets and Ray-Ban smart glasses.", headquarters: "Menlo Park, CA" },
    AMD: { description: "Advanced Micro Devices designs processors and graphics chips for PCs, servers, game consoles and embedded systems, competing with Intel in CPUs and with NVIDIA in graphics and AI accelerators.", headquarters: "Santa Clara, CA" },
    AVGO: { description: "Broadcom designs semiconductors for networking, broadband, wireless and storage, and also sells enterprise software following its acquisitions of CA Technologies, Symantec's enterprise arm and VMware.", headquarters: "Palo Alto, CA" },
    ORCL: { description: "Oracle sells database software, enterprise applications and cloud infrastructure. Its database products run much of the back-office software used by large organisations.", headquarters: "Austin, TX" },
    CRM: { description: "Salesforce sells cloud software for sales, customer service, marketing and analytics. Its customer relationship management platform is the core product, extended by acquisitions including Slack and Tableau.", headquarters: "San Francisco, CA" },
    ADBE: { description: "Adobe makes creative and document software, including Photoshop, Illustrator, Premiere Pro and Acrobat, sold mostly by subscription through Creative Cloud and Document Cloud.", headquarters: "San Jose, CA" },
    INTC: { description: "Intel designs and manufactures processors for PCs and servers. Unlike most chip designers it owns its factories, and it also sells manufacturing capacity to outside customers through Intel Foundry.", headquarters: "Santa Clara, CA" },
    CSCO: { description: "Cisco Systems makes the routers, switches and networking hardware that carry internet and corporate network traffic, and sells security and collaboration software alongside them.", headquarters: "San Jose, CA" },
    QCOM: { description: "Qualcomm designs the processors and modems used in smartphones, and licenses the wireless patents behind 3G, 4G and 5G, earning royalties on handsets built by other companies.", headquarters: "San Diego, CA" },
    TXN: { description: "Texas Instruments makes analog and embedded processing chips, the unglamorous components that manage power, convert signals and run small controllers inside industrial equipment, cars and electronics.", headquarters: "Dallas, TX" },
    IBM: { description: "IBM sells enterprise software, consulting and infrastructure to large organisations, with a focus on hybrid cloud and AI. It also runs a research division and builds mainframe and quantum computing systems.", headquarters: "Armonk, NY" },

    // Healthcare
    UNH: { description: "UnitedHealth Group runs two businesses: UnitedHealthcare, a health insurer, and Optum, which provides pharmacy benefits, care delivery and health data services.", headquarters: "Eden Prairie, MN" },
    JNJ: { description: "Johnson & Johnson develops and sells prescription medicines and medical devices, across immunology, oncology, neuroscience, surgery and orthopaedics.", headquarters: "New Brunswick, NJ" },
    LLY: { description: "Eli Lilly develops prescription medicines, with a focus on diabetes and obesity treatments, oncology, immunology and neuroscience.", headquarters: "Indianapolis, IN" },
    ABBV: { description: "AbbVie develops prescription medicines across immunology, oncology, neuroscience and eye care, and sells aesthetic products including Botox.", headquarters: "North Chicago, IL" },
    MRK: { description: "Merck develops prescription medicines and vaccines for humans, with a large oncology business, and also runs an animal health division.", headquarters: "Rahway, NJ" },
    PFE: { description: "Pfizer develops and sells prescription medicines and vaccines, across oncology, immunology, internal medicine and infectious disease.", headquarters: "New York, NY" },
    TMO: { description: "Thermo Fisher Scientific supplies laboratory instruments, reagents, consumables and software to research, clinical and industrial labs, and provides outsourced drug development and manufacturing.", headquarters: "Waltham, MA" },
    ABT: { description: "Abbott Laboratories makes medical devices, diagnostic tests, nutrition products and generic medicines, including continuous glucose monitors and cardiovascular devices.", headquarters: "North Chicago, IL" },
    DHR: { description: "Danaher supplies life sciences tools, diagnostics equipment and biotechnology manufacturing systems to research labs, hospitals and drugmakers.", headquarters: "Washington, DC" },
    AMGN: { description: "Amgen develops biologic medicines, drugs made from living cells rather than chemical synthesis, across inflammation, oncology, cardiovascular disease and bone health.", headquarters: "Thousand Oaks, CA" },
    BMY: { description: "Bristol-Myers Squibb develops prescription medicines, concentrated in oncology, haematology, immunology and cardiovascular disease.", headquarters: "Princeton, NJ" },
    GILD: { description: "Gilead Sciences develops antiviral medicines, with treatments for HIV, hepatitis and COVID-19, and a growing oncology business.", headquarters: "Foster City, CA" },
    ISRG: { description: "Intuitive Surgical makes the da Vinci robotic surgery systems used for minimally invasive procedures, and earns recurring revenue from the instruments and accessories those systems consume.", headquarters: "Sunnyvale, CA" },
    CVS: { description: "CVS Health runs retail pharmacies, the Caremark pharmacy benefit manager and the Aetna health insurer, combining drug dispensing, benefits management and insurance in one company.", headquarters: "Woonsocket, RI" },
    MDT: { description: "Medtronic makes medical devices, including pacemakers and other cardiac devices, insulin pumps, surgical instruments and neuromodulation systems.", headquarters: "Dublin, Ireland" },

    // Financials
    JPM: { description: "JPMorgan Chase is a bank. It takes deposits and lends through Chase, and runs investment banking, trading, asset management and payments businesses for corporate and institutional clients.", headquarters: "New York, NY" },
    BAC: { description: "Bank of America is a bank offering consumer deposits and lending, wealth management through Merrill, and corporate and investment banking.", headquarters: "Charlotte, NC" },
    V: { description: "Visa runs a payments network. It does not issue cards or lend money; it moves transaction messages between banks and merchants and earns fees on the volume that passes through.", headquarters: "San Francisco, CA" },
    MA: { description: "Mastercard runs a payments network, connecting banks and merchants to authorise and settle card transactions. Like Visa it earns fees on volume rather than lending.", headquarters: "Purchase, NY" },
    GS: { description: "Goldman Sachs is an investment bank. It advises on mergers and capital raising, trades securities, and manages assets for institutions and wealthy individuals.", headquarters: "New York, NY" },
    WFC: { description: "Wells Fargo is a bank offering consumer and commercial deposits and lending, mortgages, wealth management and corporate banking.", headquarters: "San Francisco, CA" },
    MS: { description: "Morgan Stanley is an investment bank and wealth manager, combining advisory and trading with a large retail brokerage built on its E*TRADE and Smith Barney acquisitions.", headquarters: "New York, NY" },
    BLK: { description: "BlackRock manages money for institutions and individuals, including the iShares family of exchange-traded funds, and licenses its Aladdin risk and portfolio management software.", headquarters: "New York, NY" },
    C: { description: "Citigroup is a bank with an unusually international footprint, offering corporate and institutional banking, treasury services, and consumer banking and cards.", headquarters: "New York, NY" },
    AXP: { description: "American Express issues payment cards and runs its own network, so it earns both merchant fees and interest, and it focuses on premium cards with annual fees and rewards.", headquarters: "New York, NY" },
    SCHW: { description: "Charles Schwab is a brokerage and bank. It holds customer investment accounts, offers trading and advice, and earns much of its money on interest from client cash.", headquarters: "Westlake, TX" },
    USB: { description: "U.S. Bancorp is a regional bank offering consumer and business deposits and lending, payment processing and wealth management, mostly across the Midwest and West.", headquarters: "Minneapolis, MN" },
    PNC: { description: "PNC Financial Services is a regional bank offering retail banking, corporate lending and asset management, with a large presence in the eastern United States.", headquarters: "Pittsburgh, PA" },
    COF: { description: "Capital One is a bank best known for credit cards, and it also offers auto lending and consumer and commercial banking.", headquarters: "McLean, VA" },
    PYPL: { description: "PayPal processes online payments for consumers and merchants, and owns Venmo, Braintree and the buy-now-pay-later product PayPal Credit.", headquarters: "San Jose, CA" },

    // Consumer
    AMZN: { description: "Amazon runs an online retail marketplace and logistics network, and owns Amazon Web Services, the cloud computing business that supplies much of its profit. It also sells advertising and runs Prime Video.", headquarters: "Seattle, WA" },
    TSLA: { description: "Tesla designs and manufactures electric vehicles, and also sells solar panels and battery storage systems. It operates its own charging network and is developing driver-assistance software.", headquarters: "Austin, TX" },
    HD: { description: "The Home Depot sells building materials, tools, appliances and garden supplies through large-format stores, to both homeowners and building professionals.", headquarters: "Atlanta, GA" },
    MCD: { description: "McDonald's runs and franchises fast-food restaurants. Most locations are owned by franchisees, so much of its income is rent and royalties rather than the sale of food.", headquarters: "Chicago, IL" },
    NKE: { description: "Nike designs and sells athletic footwear, apparel and equipment, and owns the Jordan Brand and Converse. It outsources manufacturing and sells through its own stores, its app and wholesale partners.", headquarters: "Beaverton, OR" },
    SBUX: { description: "Starbucks operates and licenses coffeehouses, and sells packaged coffee and ready-to-drink beverages through grocery channels.", headquarters: "Seattle, WA" },
    LOW: { description: "Lowe's sells home improvement products, tools, appliances and building materials through large-format stores, serving homeowners and contractors.", headquarters: "Mooresville, NC" },
    TGT: { description: "Target runs general merchandise stores selling apparel, home goods, groceries and household essentials, with a large private-label range.", headquarters: "Minneapolis, MN" },
    COST: { description: "Costco runs membership warehouse clubs, selling groceries and general merchandise in bulk at low margins. Membership fees supply much of its profit.", headquarters: "Issaquah, WA" },
    WMT: { description: "Walmart runs discount stores, supercentres and warehouse clubs, sells groceries and general merchandise, and operates a growing e-commerce and advertising business.", headquarters: "Bentonville, AR" },
    PG: { description: "Procter & Gamble makes household and personal care products, with brands including Tide, Pampers, Gillette, Crest and Bounty.", headquarters: "Cincinnati, OH" },
    KO: { description: "The Coca-Cola Company makes beverage concentrates and syrups and sells them to bottlers, who produce and distribute the finished drinks. Its brands include Coca-Cola, Sprite, Fanta and Dasani.", headquarters: "Atlanta, GA" },
    PEP: { description: "PepsiCo sells beverages and snacks. Alongside Pepsi it owns Frito-Lay, Quaker Oats, Gatorade and Tropicana, and the snack business is the larger of the two halves.", headquarters: "Purchase, NY" },
    BKNG: { description: "Booking Holdings runs online travel agencies including Booking.com, Priceline, Agoda, Kayak and OpenTable, taking a commission on reservations booked through them.", headquarters: "Norwalk, CT" },
    TJX: { description: "TJX buys surplus and end-of-season branded merchandise and sells it at a discount through T.J. Maxx, Marshalls, HomeGoods and Winners.", headquarters: "Framingham, MA" },

    // Energy
    XOM: { description: "Exxon Mobil explores for, produces and refines oil and natural gas, and manufactures petrochemicals. It operates across the whole chain from wellhead to fuel and plastics.", headquarters: "Spring, TX" },
    CVX: { description: "Chevron explores for, produces and refines oil and natural gas, and sells fuels, lubricants and petrochemicals.", headquarters: "Houston, TX" },
    COP: { description: "ConocoPhillips explores for and produces oil and natural gas. It spun off its refining arm, so it is an exploration and production company rather than an integrated one.", headquarters: "Houston, TX" },
    SLB: { description: "SLB, formerly Schlumberger, sells oilfield services and technology: drilling, well construction, reservoir evaluation and production systems for companies that own the wells.", headquarters: "Houston, TX" },
    OXY: { description: "Occidental Petroleum produces oil and natural gas, with a large position in the Permian Basin, and runs a chemicals business and carbon capture ventures.", headquarters: "Houston, TX" },
    PSX: { description: "Phillips 66 refines crude oil into fuels, transports and stores petroleum products through pipelines and terminals, and markets fuel through branded stations.", headquarters: "Houston, TX" },
    EOG: { description: "EOG Resources explores for and produces oil and natural gas onshore in the United States, principally from shale formations.", headquarters: "Houston, TX" },
    MPC: { description: "Marathon Petroleum refines crude oil into fuels and operates a large midstream network of pipelines and terminals, along with the Speedway retail brand's former footprint.", headquarters: "Findlay, OH" },
    VLO: { description: "Valero Energy refines crude oil into transportation fuels and petrochemical feedstocks, and is also one of the larger producers of ethanol and renewable diesel.", headquarters: "San Antonio, TX" },
    KMI: { description: "Kinder Morgan owns and operates pipelines and terminals that move and store natural gas, refined products and carbon dioxide, earning fees on volume rather than on the commodity price.", headquarters: "Houston, TX" },
    WMB: { description: "Williams Companies owns natural gas pipelines and processing facilities, including the Transco system, and earns fees for gathering, processing and transporting gas.", headquarters: "Tulsa, OK" },
    HAL: { description: "Halliburton sells oilfield services, including hydraulic fracturing, drilling fluids, cementing and well completion, to companies that own oil and gas wells.", headquarters: "Houston, TX" },
    DVN: { description: "Devon Energy explores for and produces oil and natural gas onshore in the United States, with its largest position in the Delaware Basin.", headquarters: "Oklahoma City, OK" },
    HES: { description: "Hess Corporation explores for and produces oil and natural gas, with operations in the Bakken shale and offshore Guyana.", headquarters: "New York, NY" },
    BKR: { description: "Baker Hughes supplies oilfield equipment and services, and also builds industrial turbines and compressors used in liquefied natural gas and other energy infrastructure.", headquarters: "Houston, TX" },

    // Communication
    NFLX: { description: "Netflix runs a subscription streaming service and produces much of its own film and television. It also sells a cheaper advertising-supported tier.", headquarters: "Los Gatos, CA" },
    DIS: { description: "The Walt Disney Company makes films and television, runs theme parks and cruise lines, owns ESPN and ABC, and operates the Disney+ and Hulu streaming services.", headquarters: "Burbank, CA" },
    T: { description: "AT&T sells mobile and broadband connectivity to consumers and businesses in the United States, and is building out fibre after divesting its media holdings.", headquarters: "Dallas, TX" },
    VZ: { description: "Verizon sells mobile and broadband service to consumers and businesses, and operates one of the two largest wireless networks in the United States.", headquarters: "New York, NY" },
    CMCSA: { description: "Comcast sells broadband and cable television, owns NBCUniversal with its studios and theme parks, and runs the Peacock streaming service and Sky in Europe.", headquarters: "Philadelphia, PA" },
    CHTR: { description: "Charter Communications sells broadband, cable television and mobile service under the Spectrum brand.", headquarters: "Stamford, CT" },
    TMUS: { description: "T-Mobile US sells mobile service and fixed wireless home internet, and grew substantially through its merger with Sprint.", headquarters: "Bellevue, WA" },
    SPOT: { description: "Spotify runs a music and podcast streaming service, funded by subscriptions and advertising, and pays rights holders a share of what it collects.", headquarters: "Stockholm, Sweden" },
    EA: { description: "Electronic Arts develops and publishes video games, including the EA Sports football and American football franchises, The Sims and Apex Legends.", headquarters: "Redwood City, CA" },
    TTWO: { description: "Take-Two Interactive publishes video games through Rockstar Games, 2K and Zynga, with franchises including Grand Theft Auto, NBA 2K and Red Dead Redemption.", headquarters: "New York, NY" },
    WBD: { description: "Warner Bros. Discovery makes films and television, owns HBO and the Warner Bros. studio, runs cable networks including CNN and Discovery, and operates the HBO Max streaming service.", headquarters: "New York, NY" },
    PARA: { description: "Paramount makes films and television through Paramount Pictures and CBS, runs cable networks including MTV, Nickelodeon and Comedy Central, and operates the Paramount+ streaming service.", headquarters: "New York, NY" },
    RBLX: { description: "Roblox runs an online platform where users build and play games made by other users. It sells an in-game currency and shares the proceeds with creators.", headquarters: "San Mateo, CA" },
    LYV: { description: "Live Nation Entertainment promotes live music events, operates concert venues and festivals, and owns Ticketmaster.", headquarters: "Beverly Hills, CA" },
    OMC: { description: "Omnicom Group is an advertising and marketing holding company, owning agencies that handle campaigns, media buying and public relations for corporate clients.", headquarters: "New York, NY" },

    // Industrials
    CAT: { description: "Caterpillar makes construction and mining equipment, diesel and gas engines, and industrial turbines, and finances customer purchases through its own lending arm.", headquarters: "Irving, TX" },
    BA: { description: "Boeing builds commercial aircraft, and also military aircraft, satellites and space systems through its defence division.", headquarters: "Arlington, VA" },
    GE: { description: "GE Aerospace designs and manufactures jet engines for commercial and military aircraft, and earns a large share of its income servicing engines already in the field.", headquarters: "Evendale, OH" },
    UPS: { description: "United Parcel Service delivers packages and freight, running its own aircraft fleet, vehicles and sorting network, and sells supply chain and logistics services.", headquarters: "Atlanta, GA" },
    HON: { description: "Honeywell makes aerospace systems, building automation and control products, industrial software, and performance materials and chemicals.", headquarters: "Charlotte, NC" },
    LMT: { description: "Lockheed Martin builds military aircraft, missiles, satellites and defence systems, selling mostly to the United States government and allied militaries.", headquarters: "Bethesda, MD" },
    RTX: { description: "RTX makes aerospace and defence products, including Pratt & Whitney engines, Collins Aerospace systems and Raytheon missiles and radars.", headquarters: "Arlington, VA" },
    DE: { description: "Deere & Company makes agricultural, construction and forestry machinery under the John Deere brand, and finances customer purchases through its own lending arm.", headquarters: "Moline, IL" },
    UNP: { description: "Union Pacific operates a freight railroad across the western United States, hauling bulk commodities, industrial products and intermodal containers.", headquarters: "Omaha, NE" },
    FDX: { description: "FedEx delivers packages and freight worldwide, running express air, ground and freight networks.", headquarters: "Memphis, TN" },
    ETN: { description: "Eaton makes electrical power management equipment, including switchgear, circuit protection and backup power, and aerospace and vehicle components.", headquarters: "Dublin, Ireland" },
    EMR: { description: "Emerson Electric makes automation equipment and software for process industries, including measurement instruments, valves and control systems.", headquarters: "St. Louis, MO" },
    NOC: { description: "Northrop Grumman builds defence and aerospace systems, including military aircraft, missiles, space systems and sensors, selling mostly to the United States government.", headquarters: "Falls Church, VA" },
    GD: { description: "General Dynamics builds submarines and warships, combat vehicles, munitions and Gulfstream business jets, and provides information technology services to government.", headquarters: "Reston, VA" },
    MMM: { description: "3M makes industrial and consumer products across adhesives, abrasives, films, filtration, personal safety equipment and healthcare supplies, including Post-it and Scotch tape.", headquarters: "St. Paul, MN" },
}

/** One symbol's written description and headquarters, or null when it is not in the list. */
export function symbolAbout(symbol: string): SymbolAbout | null {
    return SYMBOL_ABOUT[symbol.toUpperCase().trim()] ?? null
}
