// Starting content, written to data/*.json the first time the server runs.
// After that, everything is managed from the admin panel.

const portfolio = [
  { title: 'The Royal Exchange', location: 'London', category: 'Weddings', image: 'image/segun_and_ore/segunandore.jpg', featured: true },
  { title: 'Garden Estate', location: 'Essex', category: 'Weddings', image: 'deco1.webp', featured: true },
  { title: 'The Orangery', location: 'Kent', category: 'Weddings', image: 'image/raemakinde/raemakinde.jpg', featured: true },
  { title: 'Seaside Soirée', location: 'Brighton', category: 'Receptions', image: 'image/aiyela and pete/aiyela_and_pete.jpg', featured: true },
  { title: 'Urban Loft', location: 'Shoreditch', category: 'Receptions', image: 'image/chika and rose/chika_and_rose.jpg', featured: true },
  { title: 'Manor House', location: 'Cotswolds', category: 'Weddings', image: "image/don't know/dontknow.jpg", featured: true },
  { title: 'Vineyard Wedding', location: 'Surrey', category: 'Weddings', image: 'https://images.unsplash.com/photo-1460978812857-470ed1c77af0?q=80&w=800&auto=format&fit=crop', featured: false },
  { title: 'Winter Gala', location: 'Mayfair', category: 'Corporate', image: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?q=80&w=800&auto=format&fit=crop', featured: false },
  { title: 'Garden Party', location: 'Hertfordshire', category: 'Celebrations', image: 'https://images.unsplash.com/photo-1530023367847-a683933f4172?q=80&w=800&auto=format&fit=crop', featured: false }
];

const services = [
  {
    title: 'Full-Service Planning & Design',
    description: 'From the initial concept to the final farewell, we manage every intricate detail. We curate your vendor team, design your aesthetic, and orchestrate the timeline so you can remain present and joyful.',
    icon: 'planning'
  },
  {
    title: 'Customised Floral Design',
    description: 'Bespoke floral artistry that tells your story. We create immersive environments using texture, colour, and scent to transform your venue into a breathtaking, living masterpiece.',
    icon: 'floral'
  },
  {
    title: 'Celebration Day Management',
    description: 'For the couple who has planned the details but needs a professional to execute. We step in during the final weeks to ensure your celebration unfolds with seamless precision.',
    icon: 'management'
  }
];

module.exports = { portfolio, services };
