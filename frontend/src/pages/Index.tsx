import React from "react";
import Hero from "@/components/Hero";
import About from "@/components/About";
//import Statistics from "@/components/Statistics";
import Placements from "@/components/Placements";
import Recruiters from "@/components/Recruiters";
import ForStudents from "@/components/ForStudents";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    // UPDATED WRAPPER:
    // 'flex flex-col': Stacks items vertically
    // 'gap-0': Forces 0px space between components
    // 'w-full': Ensures it takes full width
    <div className="flex flex-col min-h-screen w-full p-0 m-0 gap-0">
      <Hero />
      {/* <Statistics /> */}
      <About />
      <Placements />
      <Recruiters />
      <ForStudents />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;