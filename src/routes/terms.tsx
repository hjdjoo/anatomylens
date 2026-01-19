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
            This is meant to be a free tool for study as well as a paid tool for fitness enthusiasts and more advanced users to learn about the human body, find targeted exercise, and gain a greater understanding of their own.
          </p>
          <p>
            As a Premium subscriber, You can do things like suggest exercises for a muscle and vote on exercises for visibility, but please don't abuse it. If you abuse it, we may have to revoke your membership.
          </p>
          <p>
            We only really use your data to run the app and make sure the app is working properly. We won't ever sell your data or use it in a manner external to the workings of this app.
          </p>
          <p>
            When you subscribe, you get access to our exercise library and more clinical details. It's $1.99/mo. You can cancel your subscription at any time, and you'll keep access till the end of your subscription cycle.
          </p>
          <p>
            This is meant for a slightly more adult audience, but we think it'll be useful for kids and students studying biology, too.
          </p>
          <p>
            If you try to do anything weird while using the app, like trying to access other people's data or otherwise using the app in a manner outside of its intentions, especially in a manner in which it negatively impacts the experience of other users, we reserve the right to cancel your Premium services, or do things like block your IP address from accessing the app. Please don't. We are actually just one guy in three trenchcoats, and we just want to be helpful.
          </p>
          <p>
            We would've liked to provide a female model as well, but open-source data goes back to this one project at a Japanese university where they made meshes of all the structures of the human body, called BodyParts3D - The Database Center for Life Science" under CC-BY-SA 2.1 Japan. All other attributions can be found over at the Z-anatomy project website, and the model here was acquired through Z-Anatomy under CC-BY-SA 4.0. This app would not be possible without the invaluable efforts of the folks at the Z-anatomy project.
          </p>
          <p>
            In keeping with the original spirit, the data and the base model here is free for you to clone and access under CC-BY-SA 4.0 as well.
          </p>
          <section>
            <h3 className="text-xl font-semibold text-surface-100 mb-4">
              Authors:
            </h3>
            <p>Darryl Joo</p>
          </section>
        </section>
      </div>
    </PageLayout>
  );
}

export default TermsPage;