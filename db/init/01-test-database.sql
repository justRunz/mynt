-- A second database for the test suite, so a test run cannot truncate the
-- collection someone is looking at in the browser.
--
-- Scripts in this directory run once, when the volume is first created. A test
-- database that has to survive `docker compose down -v` is therefore recreated
-- by the same command that rebuilds everything else -- see the migration runner.
create database mynt_test;
