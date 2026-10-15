import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import Shell from './components/Shell';
import Home from './pages/Home';
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
