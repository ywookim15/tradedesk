import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import HowItWorks from '@/components/landing/HowItWorks'
import PricingPreview from '@/components/landing/PricingPreview'
import EmailCapture from '@/components/landing/EmailCapture'
import Footer from '@/components/landing/Footer'

export default function LandingPage() {
  return (
    <div className="bg-[#0A0F1E] min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <PricingPreview />
      <EmailCapture />
      <Footer />
    </div>
  )
}
