import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import PlaygroundPage from './pages/PlaygroundPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/playground/:videoId' element={<PlaygroundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
