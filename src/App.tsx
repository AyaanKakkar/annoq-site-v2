import MenuIcon from '@mui/icons-material/Menu';
import { AppBar, Box, Button, Drawer, IconButton, Stack, Toolbar, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link as RouterLink, Route, Routes, useLocation } from 'react-router-dom';
import { Footer } from './components/Footer';
import { BusyProvider } from './features/busy/busyState';
import { BusyBar } from './features/busy/BusyBar';
import { SearchProvider } from './features/search/searchState';
import { ViewAllProvider } from './features/search/ViewAllDialog';
import { AnnotationSelectionProvider } from './features/annotations/AnnotationSelectionProvider';
import { SearchWorkspace } from './features/search/SearchWorkspace';
import { AboutPage, ContactPage, CookiePolicyPage, HomePage, NewsPage, VersionPage } from './pages/StaticPages';
import { DocsPage } from './pages/DocsPage';
import { SupportedAnnotationsPage } from './pages/SupportedAnnotationsPage';
import { environment } from './lib/environment';
import { trackEvent } from './lib/analytics';

const nav = [
  { label: 'News', to: '/release' },
  { label: 'Supported Annotations', to: '/detail' },
  { label: 'Data Access', to: '/docs/services' },
  { label: 'About', to: '/about' },
  { label: 'Help/Tutorial', to: '/docs' }
];

export default function App() {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const appBarRef = useAppBarHeight();
  const isSearch = location.pathname === '/search';

  useEffect(() => {
    trackEvent('page_view', {
      page_path: location.pathname + location.search,
      send_to: environment.googleAnalyticsId
    });
  }, [location.pathname, location.search]);

  const navLinks = nav.map((item) => (
    <Button key={item.to} component={RouterLink} to={item.to} className="main-nav-link" onClick={() => setOpen(false)}>
      {item.label}
    </Button>
  ));

  return (
    <Box className={isSearch ? 'app-shell app-shell--locked' : 'app-shell'}>
      <BusyProvider>
        <AppBar ref={appBarRef} position="sticky" color="inherit" elevation={0} className="main-appbar">
          <Toolbar variant="dense" className="main-toolbar">
            {isMobile && (
              <IconButton edge="start" onClick={() => setOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography component={RouterLink} to="/" className="brand" variant="h6">
              AnnoQ
            </Typography>
            <Stack direction="row" spacing={0} className="launch-buttons">
              <Button component={RouterLink} to="/search" variant="outlined">Launch Query UI</Button>
              <Button component={RouterLink} to="/docs/tutorials/ui-query" variant="outlined">UI Tutorial</Button>
            </Stack>
            <Button component={RouterLink} to="/version" className="beta-label">TopMed Beta Release</Button>
            <Box sx={{ flex: 1 }} />
            {!isMobile && <Stack direction="row">{navLinks}</Stack>}
          </Toolbar>
        </AppBar>
        <BusyBar />
        <Drawer open={open} onClose={() => setOpen(false)}>
          <Stack sx={{ width: 260, p: 1 }}>{navLinks}</Stack>
        </Drawer>
        <AnnotationSelectionProvider>
          <SearchProvider>
            <ViewAllProvider>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchWorkspace />} />
                <Route path="/detail" element={<SupportedAnnotationsPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/release" element={<NewsPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/cookie-policy" element={<CookiePolicyPage />} />
                <Route path="/version" element={<VersionPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/docs/:section" element={<DocsPage />} />
                <Route path="/docs/:section/:page" element={<DocsPage />} />
              </Routes>
            </ViewAllProvider>
          </SearchProvider>
        </AnnotationSelectionProvider>
        {!isSearch && <Footer />}
      </BusyProvider>
    </Box>
  );
}

/**
 * Publishes the AppBar's real height as --annoq-appbar-h so the portalled
 * drawers can offset themselves without assuming a constant. Measured rather
 * than hardcoded because the AppBar is 60px of toolbar plus a 1px border, and
 * that unaccounted pixel was issue #3.
 */
function useAppBarHeight() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const publish = () => {
      document.documentElement.style.setProperty(
        '--annoq-appbar-h',
        `${element.getBoundingClientRect().height}px`
      );
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
}
