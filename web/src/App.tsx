import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import Shell from './components/Shell';
import Home from './pages/Home';
import { AstroBookEntry, AstroBookIndex } from './pages/astro/Book';
import AstroHome from './pages/astro/Home';
import AstroLookup from './pages/astro/Lookup';
import { AstroProfilePage, AstroXemPage } from './pages/astro/Reading';
import { NsBookEntry, NsBookIndex } from './pages/ns/Book';
import NsHome from './pages/ns/Home';
import NsLookup from './pages/ns/Lookup';
import { NsProfilePage, NsXemPage } from './pages/ns/Reading';
import { PeoplePage, SubjectPage } from './pages/People';
import { BookEntryPage, BookIndex } from './pages/tuvi/Book';
import ChartPage from './pages/tuvi/ChartPage';
import Lookup from './pages/tuvi/Lookup';
import Phan1 from './pages/tuvi/Phan1';
import TuViHome from './pages/tuvi/TuViHome';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } });

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="nguoi" element={<PeoplePage />} />
            <Route path="nguoi/:id" element={<SubjectPage />} />
            <Route path="tu-vi" element={<TuViHome />} />
            <Route path="tu-vi/la-so" element={<ChartPage />} />
            <Route path="tu-vi/profile/:id" element={<ChartPage />} />
            <Route path="tu-vi/sach" element={<BookIndex />} />
            <Route path="tu-vi/sach/:ref" element={<BookEntryPage />} />
            <Route path="tu-vi/tra-cuu" element={<Lookup />} />
            <Route path="tu-vi/phan-1" element={<Phan1 />} />
            <Route path="nhan-so-hoc" element={<NsHome />} />
            <Route path="nhan-so-hoc/xem" element={<NsXemPage />} />
            <Route path="nhan-so-hoc/profile/:id" element={<NsProfilePage />} />
            <Route path="nhan-so-hoc/sach" element={<NsBookIndex />} />
            <Route path="nhan-so-hoc/sach/:code" element={<NsBookEntry />} />
            <Route path="nhan-so-hoc/tra-cuu" element={<NsLookup />} />
            <Route path="chiem-tinh" element={<AstroHome />} />
            <Route path="chiem-tinh/xem" element={<AstroXemPage />} />
            <Route path="chiem-tinh/profile/:id" element={<AstroProfilePage />} />
            <Route path="chiem-tinh/sach" element={<AstroBookIndex />} />
            <Route path="chiem-tinh/sach/:source/:code" element={<AstroBookEntry />} />
            <Route path="chiem-tinh/tra-cuu" element={<AstroLookup />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
