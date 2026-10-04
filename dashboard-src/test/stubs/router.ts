// Stands in for vue-router: the composer only reads the current route's params.
import { reactive } from "vue";

export const route = reactive({
	params: { mailboxId: "me@reflect.cloud", folder: "inbox" } as Record<string, string>,
});
export const useRoute = () => route;
