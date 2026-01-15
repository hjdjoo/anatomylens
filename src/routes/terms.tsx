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
          <p>
            You can do things like suggest exercises for a muscle and vote on exercises for visibility, but please don't abuse it.
          </p>
          <p>
            We only really use your data to run the app and make sure the app is working properly. We won't ever sell your data or do anything shady like that.
          </p>
          <p>
            When you subscribe, you get access to our exercise library and more clinical details. It's $1.99/mo. You can cancel your subscription at any time, and you'll keep access till the end of your subscription cycle.
          </p>
          <p>
            This is meant for a slightly more adult audience, but we think it'll be useful for kids and students studying biology, too.
          </p>
          <p>
            If you try to do anything weird while using the app, like trying to access other people's data or abusing it, we reserve the right to cancel your Premium services, or do things like block your IP address from accessing the app. Please don't. We are actually just one guy in three trenchcoats, and we just want to be helpful.
          </p>
        </section>
      </div>
    </PageLayout>
  );
}

export default TermsPage;