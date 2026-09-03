import ArticleIcon from '@mui/icons-material/Article';
import CodeIcon from '@mui/icons-material/Code';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, Button, Container, Grid, Link, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { browserVersions, releases } from '../data/staticContent';
import { useAnnotations } from '../features/annotations/useAnnotations';

export function HomePage() {
  return (
    <Box>
      <Box className="free-banner">
        <Button component={RouterLink} to="/release">AnnoQ Version 1.3.1 Released</Button>
      </Box>
      <Box className="hero">
        <Container className="hero-inner">
          <Stack spacing={3} className="hero-copy">
            <Typography variant="h2">The Annotation Query<br /><strong>(AnnoQ)</strong></Typography>
            <Typography variant="h6">An integrated and interactive platform for large-scale genetic variant annotation.</Typography>
            <Stack direction="row" spacing={1.25} className="hero-actions">
              <Button component={RouterLink} to="/search" variant="contained" className="hero-primary-button">Launch Query UI</Button>
              <Button component={RouterLink} to="/docs/tutorials/ui-query" variant="outlined" className="hero-secondary-button">UI Tutorial</Button>
            </Stack>
          </Stack>
          <Box className="hero-video">
            <iframe
              src="https://www.youtube.com/embed/plaU42-x4jE"
              title="AnnoQ tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Box>
        </Container>
      </Box>
      <Container className="content-section">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper className="stat-card">
              <Typography variant="h4">~39 million</Typography>
              <Typography variant="caption" className="stat-hint">Currently only human variants are supported</Typography>
              <Typography>pre-annotated variants from the <Link href="http://www.haplotype-reference-consortium.org" target="_blank">Haplotype Reference Consortium (HRC)</Link></Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper className="stat-card">
              <Typography variant="h4">600+</Typography>
              <Typography>Supported Annotation Types <Link component={RouterLink} to="/detail">More Details</Link></Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
      <Box className="band">
        <Container>
          <Typography variant="h4" gutterBottom>AnnoQ now supports TOPMed</Typography>
          <Typography>
            AnnoQ version 2.0-beta.1 provides over 700 million pre-annotated variants from the Trans-Omics for Precision Medicine
            program with sequence features by Whole Genome Sequence Annotator and functions from PANTHER, Gene Ontology,
            Reactome and PEREGRINE. The beta release can be accessed <Link href="https://topmed.annoq.org/" target="_blank">here</Link>.
          </Typography>
        </Container>
      </Box>
      <Container className="content-section">
        <Typography variant="h4" align="center" gutterBottom>Web Browser access</Typography>
        <Grid container spacing={3} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="h5">Easy To Use Interactive Query to support researchers</Typography>
            <Typography>Web interface with categories to focus on annotations of interest for biomedical objectives.</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <img src="/assets/images/doctor-laptop.png" className="responsive-img" alt="" />
          </Grid>
        </Grid>
        <Grid container spacing={3} sx={{ alignItems: 'center', mt: 1 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <img src="/assets/images/ui-query.png" className="responsive-img" alt="AnnoQ query interface" />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={1.1}>
              {[
                ['Select annotations', 'Organized in tree structure'],
                ['Choose Query Type', '5 types of supported queries'],
                ['Submit query', ''],
                ['View Results', 'Displayed in table and summary page'],
                ['Download Results', 'A generated file is ready to download']
              ].map(([step, detail], index) => (
                <Paper key={step} className="step-row">
                  <span className="step-number">{index + 1}</span>
                  <Box>
                    <Typography className="step-title">{step}</Typography>
                    {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Button component={RouterLink} to="/docs/tutorials/ui-query" variant="outlined">More Info</Button>
                </Paper>
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Container>
      <Box className="band">
        <Container>
          <Typography variant="h4" align="center">Additional Programmatic Access</Typography>
          <Typography align="center" sx={{ mt: 1 }}>
            Query for SNP annotations using the command-line API, Python library or R Package
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Feature icon={<CodeIcon />} title="API Data Access" text="Retrieve annotation data via command line scripts." to="/docs/services" />
            <Feature icon={<CodeIcon />} title="Python library" text="Retrieve annotations using a Python library." to="/docs/tutorials/annoq-py" />
            <Feature icon={<ArticleIcon />} title="R Package" text="Getting annotation data via R programming language." to="/docs/tutorials/r-package" />
          </Grid>
        </Container>
      </Box>
      <Container className="content-section">
        <Typography variant="h4" align="center" gutterBottom>Publication</Typography>
        <Typography align="center">
          <Link href="https://academic.oup.com/nar/article/50/W1/W57/6595265?searchresult=1" target="_blank">
            Annotation Query (AnnoQ): an integrated and interactive platform for large-scale genetic variant annotation.
          </Link>
        </Typography>
        <Typography align="center">Liu Z, Mushayahama T, Queme B, Ebert D, Muruganujan A, Mills C, Thomas PD, Mi H.</Typography>
        <Typography align="center" sx={{ fontStyle: 'italic' }}>
          Nucleic Acids Research, Volume 50, Issue W1, 5 July 2022, Pages W57-W65,{' '}
          <Link href="https://doi.org/10.1093/nar/gkac418" target="_blank">https://doi.org/10.1093/nar/gkac418</Link>
        </Typography>
      </Container>
      <Box className="band">
        <Container>
          <Typography variant="h5" align="center" gutterBottom>We recommend the services of our trusted resources</Typography>
          <Typography component="p" sx={{ mb: 2 }}>
            We could not do it without our partners and collaborators. The variants data set was from the Haplotype Reference Consortium (HRC),
            and was pre-annotated with sequence features by WGSA and functions by PANTHER and Gene Ontology. We are very grateful for the
            reliable data and tools they provide. Last, this work is not possible without the support from the members at the{' '}
            <Link href="https://p01.uscbiostatistics.org/" target="_blank">USC IMAGE Project</Link>. Funding of this project is provided by NIH.
          </Typography>
          <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'center' }}>
            <Logo href="https://p01.uscbiostatistics.org/" src="/assets/images/logos/image-logo-mono.png" label="IMAGE" />
            <Logo href="https://sites.google.com/site/jpopgen/wgsa" label="WGSA" />
            <Logo href="http://pantherdb.org/" src="/assets/images/logos/panther-logo-mono.png" label="PANTHER" />
            <Logo href="http://geneontology.org/" src="/assets/images/logos/go-logo-mono.png" label="GO" />
            <Logo href="http://www.haplotype-reference-consortium.org" label="HRC" />
          </Grid>
        </Container>
      </Box>
      <Container className="content-section">
        <Typography variant="h4" align="center" gutterBottom>Browser Compatibility Summary</Typography>
        <Typography align="center" sx={{ mb: 2 }}>
          For more details on AnnoQ&apos;s browser support and future work, check out{' '}
          <Link component={RouterLink} to="/docs/getting_started/browser_compatibility">more details</Link>.
        </Typography>
        <DataTable
          columns={['OS', 'Version', 'Chrome', 'Firefox', 'Microsoft Edge', 'Safari']}
          rows={browserVersions.map((row) => [row.os, row.version, row.chrome, row.firefox, row.edge, row.safari])}
        />
      </Container>
    </Box>
  );
}

function Feature({ icon, title, text, to }: { icon: React.ReactNode; title: string; text: string; to: string }) {
  return (
    <Grid size={{ xs: 12, md: 4 }}>
      <Paper className="feature-card">
        <Box className="feature-icon">{icon || <CheckCircleIcon />}</Box>
        <Typography variant="h6">{title}</Typography>
        <Typography>{text}</Typography>
        <Button component={RouterLink} to={to} variant="outlined">View Details</Button>
      </Paper>
    </Grid>
  );
}

function Logo({ href, src, label }: { href: string; src?: string; label: string }) {
  return (
    <Grid size={{ xs: 6, md: 2 }}>
      <Paper className="logo-card">
        <Link href={href} target="_blank" rel="noreferrer">
          {src ? <img src={src} alt={label} /> : <strong>{label}</strong>}
        </Link>
      </Paper>
    </Grid>
  );
}

export function AboutPage() {
  return <SimplePage title="About AnnoQ">
    <Typography>
      The Annotation Query (AnnoQ) is an integrated functional annotation platform for large-scale genetic variant annotation.
      The backend of the system is a large collection of pre-annotated variants from the Haplotype Reference Consortium (HRC)
      (~39 million) with sequence features (by WGSA) and functions (PANTHER, Gene Ontology and Reactome). Currently only human
      variants are supported. The data is built in an Elasticsearch framework and an API was built to allow users to quickly
      access the annotation data in three ways:
    </Typography>
    <ol>
      <li><Link href="https://annoq.org">Interactive web interface</Link>.</li>
      <li><Link href="https://api-v2.annoq.org/docs">API</Link> data access using command line scripts.</li>
      <li>Software libraries <Link href="https://github.com/USCbiostats/AnnoQR">AnnoQR</Link> in R and <Link href="https://github.com/USCbiostats/annoq-py">annoq-py</Link> in Python.</li>
    </ol>
    <img src="/assets/images/annoq_workflow.png" className="wide-workflow" alt="AnnoQ workflow" />
    <Typography variant="h4">Current members</Typography>
    <ul>
      <li><strong>Queme, Bryan</strong> (PhD student, AnnoQ Development)</li>
      <li><strong>Muruganujan, Anushya</strong> (software engineer, GO and PANTHER data)</li>
      <li><strong>Ebert, Dustin</strong> (bioinformatics programmer, GO and PANTHER data)</li>
      <li><strong>Mi, Huaiyu</strong> (Principal Investigator)</li>
    </ul>
    <Typography variant="h4">Past members</Typography>
    <ul>
      <li><strong>Liu, Zhu</strong> (PhD student, lead developer, Overall Architectect)</li>
      <li><strong>Mills, Caitlin</strong> (PhD student, PEREGRINE development)</li>
      <li><strong>Mushayahama, Tremayne</strong> (software engineer, AnnoQ Website)</li>
      <li><strong>Ayaan Kakkar</strong> (masters student, software developer, AnnoQ API and website)</li>
      <li><strong>Akshala Bhatnagar</strong> (masters student, AnnoQ API)</li>
     <li><strong>Ayaan Kakkar</strong> (masters student, software developer, AnnoQ API and website)</li>
  
    </ul>
    <Typography variant="h4">Publication</Typography>
    <Typography>
      <Link href="https://academic.oup.com/nar/article/50/W1/W57/6595265?searchresult=1" target="_blank">
        Annotation Query (AnnoQ): an integrated and interactive platform for large-scale genetic variant annotation.
      </Link>{' '}
      Liu Z, Mushayahama T, Queme B, Ebert D, Muruganujan A, Mills C, Thomas PD, Mi H.
    </Typography>
    <Typography sx={{ fontStyle: 'italic' }}>
      Nucleic Acids Research, Volume 50, Issue W1, 5 July 2022, Pages W57-W65,{' '}
      <Link href="https://doi.org/10.1093/nar/gkac418" target="_blank">https://doi.org/10.1093/nar/gkac418</Link>
    </Typography>
    <Typography variant="h4">Funding</Typography>
    <Typography>AnnoQ project is supported by a P01 grant from the National Cancer Institute (P01CA19656)</Typography>
  </SimplePage>;
}

export function NewsPage() {
  return <SimplePage title="Release Information">
    <Table className="annoq-table news-table">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Title</TableCell>
          <TableCell>Version</TableCell>
          <TableCell>Description</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {releases.map((release, index) => (
          <TableRow key={`${release.version}-${index}`}>
            <TableCell>{release.date}</TableCell>
            <TableCell>{release.title}</TableCell>
            <TableCell>{release.version}</TableCell>
            <TableCell>
              {release.description.map((section, sectionIndex) => (
                <Box key={sectionIndex} sx={{ mb: 1 }}>
                  {section.heading && <Typography variant="subtitle2">{section.heading}</Typography>}
                  <ul>{section.items.map((item, itemIndex) => <li key={itemIndex} dangerouslySetInnerHTML={{ __html: item }} />)}</ul>
                  {section.subitems && <ul className="subitems">{section.subitems.map((item) => <li key={item}>{item}</li>)}</ul>}
                </Box>
              ))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </SimplePage>;
}

export function ContactPage() {
  return <SimplePage title="Contact Us">
    <Typography align="center">
      For comments and feedback about the AnnoQ, please send email to
    </Typography>
    <Typography variant="h5" align="center">
      <Link href="mailto:annoqfeedback@gmail.com" target="_blank">Email US: annoqfeedback@gmail.com</Link>
    </Typography>
  </SimplePage>;
}

export function CookiePolicyPage() {
  return <SimplePage title="Cookie Policy for AnnoQ Site">
    <Typography>This is the Cookie Policy for AnnoQ Site</Typography>
    <Typography variant="h6">What Are Cookies</Typography>
    <Typography>
      As is common practice with almost all professional websites this site uses cookies, which are tiny files that are
      downloaded to your computer, to improve your experience. This page describes what information they gather, how we use
      it and why we sometimes need to store these cookies. We will also share how you can prevent these cookies from being
      stored however this may downgrade or &apos;break&apos; certain elements of the sites functionality.
    </Typography>
    <Typography variant="h6">How We Use Cookies</Typography>
    <Typography>
      We use cookies for a variety of reasons detailed below. Unfortunately in most cases there are no industry standard
      options for disabling cookies without completely disabling the functionality and features they add to this site.
    </Typography>
    <Typography variant="h6">Disabling Cookies</Typography>
    <Typography>
      You can prevent the setting of cookies by adjusting the settings on your browser. Be aware that disabling cookies
      will affect the functionality of this and many other websites that you visit.
    </Typography>
    <Typography variant="h6">The Cookies We Set</Typography>
    <ul>
      <li>
        <Typography>Site preferences cookies</Typography>
        <Typography>
          In order to provide you with a great experience on this site we provide the functionality to set your preferences
          for how this site runs when you use it.
        </Typography>
      </li>
    </ul>
    <Typography variant="h6">Third Party Cookies</Typography>
    <ul>
      <li>
        <Typography>
          This site uses Google Analytics which is one of the most widespread and trusted analytics solution on the web for
          helping us to understand how you use the site and ways that we can improve your experience. These cookies may
          track things such as how long you spend on the site and the pages that you visit so we can continue to produce
          engaging content.
        </Typography>
        <Typography>For more information on Google Analytics cookies, see the official Google Analytics page.</Typography>
      </li>
    </ul>
    <Typography variant="h6">More Information</Typography>
    <Typography>
      Hopefully that has clarified things for you. However if you are still looking for more information then you can
      contact us through one of our preferred contact methods:
    </Typography>
    <ul>
      <li>Email: <Link href="mailto:annoqfeedback@gmail.com" target="_blank">Email US: annoqfeedback@gmail.com</Link></li>
    </ul>
  </SimplePage>;
}

export function VersionPage() {
  return <VersionContent />;
}

function SimplePage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Container className="simple-page">
      <Typography variant="h3" gutterBottom>{title}</Typography>
      <Stack spacing={2}>{children}</Stack>
    </Container>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <Table className="annoq-table">
      <TableHead>
        <TableRow>{columns.map((column) => <TableCell key={column}>{column}</TableCell>)}</TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function VersionContent() {
  const annotations = useAnnotations();
  const rows = (annotations.data?.annotations ?? [])
    .filter((annotation) => annotation.version && annotation.name)
    .map((annotation) => [annotation.label || annotation.name, annotation.version || '']);
  return <SimplePage title="Data Source and Annotation Tool Version Summary">
    <Typography color="text.secondary">Built using <Link href="https://sites.google.com/site/jpopgen/wgsa">WGSA</Link> version 095</Typography>
    {annotations.isLoading ? (
      <Typography>Loading version information...</Typography>
    ) : (
      <DataTable columns={['SNP Detail/Annotation Tool', 'Version']} rows={rows} />
    )}
  </SimplePage>;
}
