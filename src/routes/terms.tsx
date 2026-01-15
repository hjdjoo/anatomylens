/**
 * Terms of Service Page
 * 
 * Legal terms for using AnatomyLens.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PageLayout } from '@/components/layout/PageLayout';

export const Route = createFileRoute('/terms')({
  component: TermsPage,
});

function TermsPage() {
  return (
    <PageLayout
      title="Terms of Service"
      subtitle="Last updated: January 2025"
    >
      <div className="space-y-8 text-surface-300">
        {/* 
          ============================================================
          PASTE YOUR TERMS OF SERVICE CONTENT BELOW
          ============================================================
          
          The content is styled automatically. Use these HTML elements:
          
          <h2 className="text-xl font-semibold text-surface-100 mt-8 mb-4">Section Title</h2>
          <p>Paragraph text...</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>List item</li>
          </ul>
          
          ============================================================
        */}

        <section>
          <h2 className="text-xl font-semibold text-surface-100 mb-4">
            Terms of Service:
          </h2>
          <p>
            {/* Your content here */}
            This is meant to be a free tool for study as well as a paid tool for fitness enthusiasts to learn about the human body and find new exercises.
          </p>
        </section>
      </div>
    </PageLayout>
  );
}

export default TermsPage;