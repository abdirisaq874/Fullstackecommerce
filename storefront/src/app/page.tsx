import { Hero, ValueProps } from '@/components/home/Hero';
import {
  FeaturedSection, NewArrivalsSection, BestsellersSection, CategoryGrid, BrandStrip,
} from '@/components/home/sections';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ValueProps />
      <CategoryGrid />
      <FeaturedSection />
      <NewArrivalsSection />
      <BestsellersSection />
      <BrandStrip />
    </>
  );
}
