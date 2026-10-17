import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import Shell from './components/Shell';
import { isLegacy, legacyUrl } from './lib/legacy';
import Home from './pages/Home';
import { AstroBookEntry, AstroBookIndex } from './pages/astro/Book';
import AstroHome from './pages/astro/Home';
import AstroLookup from './pages/astro/Lookup';
import { AstroProfilePage, AstroViewPage } from './pages/astro/Reading';
import { NumerologyBookEntry, NumerologyBookIndex } from './pages/numerology/Book';
import NumerologyHome from './pages/numerology/Home';
import NumerologyLookup from './pages/numerology/Lookup';
import { NumerologyProfilePage, NumerologyViewPage } from './pages/numerology/Reading';
import { PeoplePage, SubjectPage } from './pages/People';
import { BookEntryPage, BookIndex } from './pages/tuvi/Book';
import ChartPage from './pages/tuvi/ChartPage';
import Lookup from './pages/tuvi/Lookup';
import SetupPage from './pages/tuvi/Setup';
import TuViHome from './pages/tuvi/TuViHome';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } });

/** every page in its frame; an old link (with Vietnamese words in its address) is first sent to its new one */
function Root() {
  const { pathname, search, hash } = useLocation();
  const old = isLegacy(pathname, search);
  const here = pathname + search + hash;
  const [moved, setMoved] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    if (old) void legacyUrl(pathname, search, hash).then(to => setMoved({ from: here, to }));
  }, [old, here]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!old) return <Shell />;
  return moved?.from === here ? <Navigate to={moved.to} replace /> : null;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<Root />}>
            <Route index element={<Home />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="people/:id" element={<SubjectPage />} />
            <Route path="tu-vi" element={<TuViHome />} />
            <Route path="tu-vi/chart" element={<ChartPage />} />
            <Route path="tu-vi/profile/:id" element={<ChartPage />} />
            <Route path="tu-vi/books" element={<BookIndex />} />
            <Route path="tu-vi/books/:ref" element={<BookEntryPage />} />
            <Route path="tu-vi/lookup" element={<Lookup />} />
            <Route path="tu-vi/setup" element={<SetupPage />} />
            <Route path="numerology" element={<NumerologyHome />} />
            <Route path="numerology/view" element={<NumerologyViewPage />} />
            <Route path="numerology/profile/:id" element={<NumerologyProfilePage />} />
            <Route path="numerology/books" element={<NumerologyBookIndex />} />
            <Route path="numerology/books/:code" element={<NumerologyBookEntry />} />
            <Route path="numerology/lookup" element={<NumerologyLookup />} />
            <Route path="astrology" element={<AstroHome />} />
            <Route path="astrology/view" element={<AstroViewPage />} />
            <Route path="astrology/profile/:id" element={<AstroProfilePage />} />
            <Route path="astrology/books" element={<AstroBookIndex />} />
            <Route path="astrology/books/:source/:code" element={<AstroBookEntry />} />
            <Route path="astrology/lookup" element={<AstroLookup />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
