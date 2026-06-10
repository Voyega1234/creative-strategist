import { redirect } from "next/navigation";

type V2RedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildHomeUrl(params?: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) query.append(key, item);
      }
    } else if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString ? `/?${queryString}` : "/";
}

export default async function CreativeStrategistV2Redirect({ searchParams }: V2RedirectPageProps) {
  redirect(buildHomeUrl(await searchParams));
}
