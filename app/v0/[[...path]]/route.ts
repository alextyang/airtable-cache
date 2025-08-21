import { NextRequest } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const FORGET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

let cache: { [referrer: string]: { [url: string]: any } } = {};
let timestamps: { [referrer: string]: { [url: string]: number } } = {};

export async function GET(request: NextRequest) {
    let { searchParams, pathname } = request.nextUrl;

    let pageKey = request.headers.get("referer");
    const referrer = pageKey?.split("/")[2] || "unknown";

    // Extract path segments from the pathname
    let path = pathname
        .replace(/^\/app\/|\/$/g, "") // Remove leading '/app/' and trailing '/'
        .split("/")
        .filter(Boolean);

    let params = searchParams.toString();

    if (!path || path.length === 0) {
        path = [""]; // Handle the case where no path is provided
    }

    const url = `https://api.airtable.com/${path.join("/")}?${params}`;
    console.log("\n\n[API] Request: " + decodeURIComponent(url));

    let data: any;

    if (!cache[referrer]) {
        cache[referrer] = {};
        timestamps[referrer] = {};
    }

    if (cache[referrer][url]) {
        console.log("\n[API] Cache hit for URL:", decodeURIComponent(url));
        data = cache[referrer][url];

        const lastUpdated = timestamps[referrer][url] || 0;
        if (Date.now() - lastUpdated > REFRESH_INTERVAL)
            refreshCache(url, referrer);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    console.log("\n[API] Cache miss for URL:", decodeURIComponent(url));

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
    });

    data = await response.json();

    if (response.ok) {
        cache[referrer][url] = data;
        timestamps[referrer][url] = Date.now();
    }

    saveCache(referrer);

    console.log("[API] Response: ", response.status);

    return new Response(JSON.stringify(data),
        {
            status: response.status,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
}

async function saveCache(referrerHostname: string) {
    const cacheString = `export const cache = ${JSON.stringify(cache[referrerHostname])};
    window.airtableCache = cache;`;

    const fs = require('fs');
    const path = require('path');
    const cacheFilePath = path.join(process.cwd(), 'public', 'cache-' + referrerHostname + '.js');

    fs.writeFileSync(cacheFilePath, cacheString, 'utf8');
    console.log("[API] Cache saved to", cacheFilePath);
}

async function refreshCache(url: string, referrerHostname: string) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (response.ok) {
        cache[referrerHostname][url] = data;
        timestamps[referrerHostname][url] = Date.now();
        console.log("[API] Cache refreshed for URL:", decodeURIComponent(url));
    }

    for (const key in cache[referrerHostname]) {
        if (Date.now() - timestamps[referrerHostname][key] > FORGET_INTERVAL) {
            console.log("[API] Forgetting cache for URL:", decodeURIComponent(key));
            delete cache[key];
            delete timestamps[key];
        }
    }

    saveCache(referrerHostname);
}

// http://localhost:4444/v0/appHcZTzlfXAJpL7I/tblm2TqCcDcx94nA2?filterByFormula=OR(FIND('September 2025', ARRAYJOIN({Cohort}, ',')) > 0, {Cohort} = 'September 2025',FIND('October 2025', ARRAYJOIN({Cohort}, ',')) > 0, {Cohort} = 'October 2025',FIND('November 2025', ARRAYJOIN({Cohort}, ',')) > 0, {Cohort} = 'November 2025')