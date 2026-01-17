import { useRef, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useToast } from "@/store";


export function useSubscriptionFeedback() {

  const search = useSearch({ from: "/" });
  const navigate = useNavigate();
  const toast = useToast();

  const handled = useRef<boolean>(false);

  useEffect(() => {

    if (handled.current) {
      return;
    }

    handled.current = true;

    const { subscription, session_id } = search

    if (!subscription) return;

    if (subscription === 'success') {
      // show toast notification
      toast.success("Welcome to Premium!", "Your subscription is now active. Enjoy full access to exercises and clinical details.");
      console.log('[Subscription] Success, session_id: ', session_id)
    } else if (subscription === 'canceled') {
      // show toast notification
      toast.info('Checkout Canceled', 'No worries! You can subscribe anytime from your profile.'
      )
    } else {
      console.warn('[Subscription] Unknown param: ', subscription)
    };

    navigate({
      to: "/",
      search: {},
      replace: true
    })

  }, [search, navigate, toast])

};

export default useSubscriptionFeedback;