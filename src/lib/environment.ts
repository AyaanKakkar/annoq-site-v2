export const environment = {
  // TOPMed cutover (annoq-site#78). Only the *dev* TOPMed api-v2 carries the
  // `search_hrc` argument today; api-v2.topmed.annoq.org still runs the
  // issue-19 line, where the "Search HRC data" checkbox would error. Flip this
  // to https://api-v2.topmed.annoq.org at cutover, once the api-v2 #78 branch
  // is deployed there. VITE_ANNOQ_API_V2 overrides it at run time either way.
  dataset: import.meta.env.VITE_ANNOQ_DATASET ?? 'annoq-annotations-tm-20260828',
  production: import.meta.env.PROD,
  annotationApiV2: import.meta.env.VITE_ANNOQ_API_V2 ?? import.meta.env.VITE_ANNOV_API_BASE ?? 'http://localhost:8001',
  snpResultsSize: Number(import.meta.env.VITE_ANNOQ_SNP_RESULTS_SIZE ?? 50),
  termsDisplayedSize: Number(import.meta.env.VITE_ANNOQ_TERMS_DISPLAYED_SIZE ?? (import.meta.env.PROD ? 5 : 8)),
  genesDisplayedSize: Number(import.meta.env.VITE_ANNOQ_GENES_DISPLAYED_SIZE ?? 5),
  amigoTermUrl: import.meta.env.VITE_ANNOQ_AMIGO_TERM_URL ?? 'http://amigo.geneontology.org/amigo/term/',
  pubmedUrl: import.meta.env.VITE_ANNOQ_PUBMED_URL ?? 'https://www.ncbi.nlm.nih.gov/pubmed/',
  ucscUrl:
    import.meta.env.VITE_ANNOQ_UCSC_URL ??
    'https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&lastVirtModeType=default&lastVirtModeExtraState=&virtModeType=default&virtMode=0&nonVirtPosition=&position=chr',
  googleAnalyticsId: import.meta.env.VITE_ANNOQ_GA_ID ?? 'G-ZRDY68GK00'
};
