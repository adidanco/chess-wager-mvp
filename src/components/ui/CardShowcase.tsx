import React from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import PageLayout from '../common/PageLayout';

/**
 * Component to showcase all available Card variants for Gam(e)Bit
 */
const CardShowcase: React.FC = () => {
  return (
    <PageLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold text-deep-purple mb-6">Gam(e)Bit Card Component Showcase</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Default Card */}
          <Card 
            title="Default Card" 
            subtitle="Standard card with white background"
            footer={<div className="flex justify-end"><Button size="small" variant="text">Cancel</Button><Button size="small" className="ml-2">Save</Button></div>}
          >
            <p className="text-gray-700">This is the default card style with a clean white background. Ideal for most content displays.</p>
          </Card>
          
          {/* Outlined Card */}
          <Card 
            variant="outlined"
            title="Outlined Card" 
            subtitle="Light background with subtle border"
            isHoverable
          >
            <p className="text-gray-700">This outlined variant has a light background with a soft pink border. It's perfect for secondary content.</p>
          </Card>
          
          {/* Accent Card */}
          <Card 
            variant="accent"
            title="Accent Card" 
            subtitle="Subtle lavender background"
            footer={<span className="text-sm text-muted-violet">Last updated: Today</span>}
          >
            <p className="text-gray-700">The accent variant uses our brand's lavender color as a subtle background, great for highlighting important content.</p>
          </Card>
          
          {/* Primary Card */}
          <Card 
            variant="primary"
            title="Primary Card" 
            subtitle="Deep purple background from our brand colors"
            isHoverable
          >
            <p className="text-white">This primary variant uses our main brand color as the background, creating high visual impact. Great for CTAs or important information.</p>
          </Card>
          
          {/* Dark Card */}
          <Card 
            variant="dark"
            title="Dark Card" 
            subtitle="Dark purple variant for high contrast"
            footer={<Button variant="outline" className="w-full text-white border-white">View Details</Button>}
          >
            <p className="text-white">The dark variant is perfect for creating contrast on lighter backgrounds or for a more premium feel.</p>
          </Card>
          
          {/* Clickable Card */}
          <Card 
            title="Clickable Card" 
            subtitle="Cards can also be interactive"
            isHoverable
            onClick={() => alert('Card clicked!')}
          >
            <div className="flex items-center justify-center h-24">
              <p className="text-muted-violet font-medium">Click me!</p>
            </div>
          </Card>
        </div>
        
        <h2 className="text-xl font-bold text-deep-purple mb-4">Cards with Custom Styling</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card with No Padding */}
          <Card 
            title="No Padding Card"
            subtitle="Content goes edge to edge"
            noPadding
          >
            <div className="bg-soft-lavender/10 p-4">
              <p className="text-gray-700">This card has the noPadding prop set to true, allowing content to define its own padding.</p>
            </div>
            <div className="bg-soft-pink/10 p-4">
              <p className="text-gray-700">This is great for creating sections with different background colors.</p>
            </div>
          </Card>
          
          {/* Card with Custom Classes */}
          <Card 
            title="Custom Styling"
            subtitle="Using the className props"
            headerClassName="bg-soft-pink/20"
            bodyClassName="bg-off-white"
            footerClassName="bg-muted-violet/10"
            footer={<p className="text-xs text-center text-muted-violet">Custom footer styling</p>}
          >
            <p className="text-gray-700">This card demonstrates how to apply custom classes to different parts of the card - header, body, and footer.</p>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default CardShowcase; 