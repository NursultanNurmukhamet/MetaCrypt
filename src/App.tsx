/**
 * Application root: routing + global providers.
 *
 * HashRouter is a deliberate choice: GitHub Pages serves static files only,
 * and hash-based routes survive deep links / refreshes without any server
 * rewrite rules. The same build works from any sub-path.
 */

import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ImageStoreProvider } from '@/hooks/useImageStore';
import { HomePage } from '@/pages/HomePage';
import { EditorPage } from '@/pages/editor/EditorPage';
import { VaultPage } from '@/pages/VaultPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <ImageStoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="editor" element={<EditorPage />} />
            <Route path="vault" element={<VaultPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ImageStoreProvider>
  );
}
