import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { Preview } from './components/Preview'
import { Reach } from './components/Reach'
import { HowItWorks } from './components/HowItWorks'
import { Download } from './components/Download'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <Preview />
        <Reach />
        <HowItWorks />
        <Download />
      </main>
      <Footer />
    </>
  )
}
