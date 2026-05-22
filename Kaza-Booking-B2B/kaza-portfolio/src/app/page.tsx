import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AuthorityStrip from "@/components/AuthorityStrip";
import ProblemSolutionSection from "@/components/ProblemSolutionSection";
import ServicesSection from "@/components/ServicesSection";
import ROICalculator from "@/components/ROICalculator";
import WhyKazaSection from "@/components/WhyKazaSection";
import LeadershipSection from "@/components/LeadershipSection";
import ProcessSection from "@/components/ProcessSection";
import FinalCTASection from "@/components/FinalCTASection";

export default function Home() {
  return (
    <main className="w-full">
      <Header />
      <HeroSection />
      <AuthorityStrip />
      <ProblemSolutionSection />
      <ServicesSection />
      <ROICalculator />
      <WhyKazaSection />
      <LeadershipSection />
      <ProcessSection />
      <FinalCTASection />
    </main>
  );
}
