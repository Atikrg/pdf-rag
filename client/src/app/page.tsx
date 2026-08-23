// SERVER COMPONENT — no "use client" needed
import Navbar from "@/components/ui/Navbar";
import Hero from "@/components/sections/Hero";
import Features from "@/components/sections/Features";
import HowItWorks from "@/components/sections/HowItWorks";
import ChatDemo from "@/components/sections/ChatDemo";
import CTA from "@/components/sections/CTA";
import Footer from "@/components/ui/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-offwhite">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <ChatDemo />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
