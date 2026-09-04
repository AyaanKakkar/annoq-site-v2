import { Box, CircularProgress, Container, Link, List, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

const sections = [
  { title: 'Getting Started', path: '/docs', links: [{ title: 'Browser Compatibility', path: '/docs/getting_started/browser_compatibility' }] },
  { title: 'Services', path: '/docs/services', links: [{ title: 'Programmatic Access to AnnoQ', path: '/docs/services/api' }] },
  {
    title: 'Tutorials',
    path: '/docs/tutorials',
    links: [
      { title: 'Interactive Query UI', path: '/docs/tutorials/ui-query' },
      { title: 'Using AnnoQR (R Package)', path: '/docs/tutorials/r-package' },
      { title: 'Using annoq-py (Python Library)', path: '/docs/tutorials/annoq-py' }
    ]
  }
];

export function DocsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(resolveAssetPath(location.pathname), { signal: controller.signal })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error('not found')))
      .then((markdown) => setContent(normalizeMarkdown(markdown)))
      .catch(() => setContent('# Documentation page not found\n\nThe requested page is unavailable.'))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [location.pathname]);

  return (
    <Container className="docs-page">
      <Paper className="docs-shell">
        <Box className="docs-nav">
          <List dense>
            {sections.map((section) => (
              <Box key={section.path}>
                <ListItemButton component={RouterLink} to={section.path} selected={location.pathname === section.path}>
                  <ListItemText primary={section.title} />
                </ListItemButton>
                {section.links.map((link) => (
                  <ListItemButton key={link.path} component={RouterLink} to={link.path} selected={location.pathname === link.path} sx={{ pl: 3 }}>
                    <ListItemText primary={<Typography variant="body2">{link.title}</Typography>} />
                  </ListItemButton>
                ))}
              </Box>
            ))}
          </List>
        </Box>
        <Box className="docs-content">
          {loading ? <CircularProgress /> : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                // className, target, and rel are forwarded, not dropped: the
                // markdown files carry raw HTML blocks (the API callout) whose
                // styling and new-tab behaviour live on the tags themselves.
                // Defaults are unchanged, so plain markdown links behave as before.
                a: ({ href, children, className, target, rel }) => {
                  if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
                    return <Link href={href} className={className} target={target} rel={rel}>{children}</Link>;
                  }
                  return <Link component="button" className={className} onClick={() => navigate(href)}>{children}</Link>;
                },
                h1: ({ children }) => <Typography variant="h3" gutterBottom>{children}</Typography>,
                h2: ({ children }) => <Typography variant="h4" gutterBottom>{children}</Typography>,
                p: ({ children, className }) => <Typography component="p" className={className} sx={{ mb: 2 }}>{children}</Typography>,
                // An explicit class replaces `docs-media` rather than joining it:
                // the callout logo must not inherit its full-width centred block layout.
                img: ({ src, alt, className }) => <img className={className ?? 'docs-media'} src={src} alt={alt ?? ''} />,
                iframe: (props) => <iframe className="docs-iframe" {...props} />
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

function resolveAssetPath(path: string): string {
  if (path === '/docs' || path === '/docs/') return '/assets/docs/index.md';
  const suffix = path.replace(/^\/docs\/?/, '');
  const parts = suffix.split('/').filter(Boolean);
  if (parts.length === 1) return `/assets/docs/docs/${parts[0]}/index.md`;
  return `/assets/docs/docs/${parts.join('/')}.md`;
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .trimStart()
    .replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/m, '')
    .replace(/^(?:-{3,}|\*{3,})\s*[\r\n]+/, '');
}
