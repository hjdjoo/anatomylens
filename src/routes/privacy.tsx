/**
 * Privacy Policy Page
 * 
 * Data handling and privacy practices for AnatomyLens.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PageLayout } from '@/components/layout/PageLayout';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PageLayout
      title="Privacy Policy"
      subtitle="Last updated: January 2025"
    >
      <div className="space-y-8 text-surface-300">
        {/* 
          ============================================================
          PASTE YOUR PRIVACY POLICY CONTENT BELOW
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
            Privacy Policy
          </h2>
          <div className="space-y-4">
            <p>
              A fuller privacy policy should be on its, way, but for now:
            </p>
            <p>
              {/* Your content here */}
              We basically only collect the barest minimum of information possible.
            </p>
            <p>
              We store whatever information you provide, and if you sign in with Google, just the basics: your name and your email. We do not use any tracking or advertising cookies. We use one token for managing your session, and that's about it.
            </p>
            <p>
              We use information collected to improve the app. We'll never sell your information or misuse it.
            </p>
            <p>
              Your payment is securely managed through Stripe, and we will not see any of your data beyond what Stripe provides for managing your subscription.
            </p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

export default PrivacyPage;