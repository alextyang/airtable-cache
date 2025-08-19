import { NextRequest } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let cache: { [key: string]: any } = {};
let timestamps: { [key: string]: number } = {};

export async function GET(request: NextRequest) {
    let { searchParams, pathname } = request.nextUrl;
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

    if (cache[url]) {
        console.log("\n[API] Cache hit for URL:", decodeURIComponent(url));
        data = cache[url];

        const lastUpdated = timestamps[url] || 0;
        if (Date.now() - lastUpdated > REFRESH_INTERVAL)
            refreshCache(url);

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
        cache[url] = data;
        timestamps[url] = Date.now();
    }

    saveCache();

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

async function saveCache() {
    const cacheString = `export const cache = ${JSON.stringify(cache)};`;
    const fs = require('fs');
    const path = require('path');
    const cacheFilePath = path.join(process.cwd(), 'public', 'cache.js');

    fs.writeFileSync(cacheFilePath, cacheString, 'utf8');
    console.log("[API] Cache saved to", cacheFilePath);
}

async function refreshCache(url: string) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (response.ok) {
        cache[url] = JSON.stringify(data);
        timestamps[url] = Date.now();
        console.log("[API] Cache refreshed for URL:", decodeURIComponent(url));
    }

    saveCache();
}

// http://localhost:4444/v0/appHcZTzlfXAJpL7I/tblm2TqCcDcx94nA2?filterByFormula=OR(FIND('September 2025', ARRAYJOIN({Cohort}, ',')) > 0, {Cohort} = 'September 2025',FIND('October 2025', ARRAYJOIN({Cohort}, ',')) > 0, {Cohort} = 'October 2025',FIND('November 2025', ARRAYJOIN({Cohort}, ',')) > 0, {Cohort} = 'November 2025')