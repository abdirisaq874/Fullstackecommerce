import { Hero } from '@/components/home/Hero';
import {
  TrustStrip, DealsOfDay, SpotlightRail, NewArrivals, BestSellers, BrandTiles, WhyUsReviews, Newsletter,
} from '@/components/home/sections';

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <DealsOfDay />
      <SpotlightRail title="Popular in Tech" sortBy="popular" href="/c/electronics" />
      <SpotlightRail title="Popular in Home & Kitchen" sortBy="newest" href="/c/home-and-garden" />
      <BrandTiles />
      <NewArrivals />
      <BestSellers />
      <WhyUsReviews />
      <Newsletter />
    </>
  );
}
