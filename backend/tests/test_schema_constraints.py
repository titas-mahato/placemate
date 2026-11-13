"""Integrity rules that must hold at the DATABASE level, independent of the API code."""
import mysql.connector
import pytest


def test_application_must_target_exactly_one_listing(make, sql):
    make.student("S1"); co = make.company(); lid = make.listing(co)
    with pytest.raises(mysql.connector.Error):          # neither listing
        sql("INSERT INTO applications (student_id) VALUES ('S1')")
    with pytest.raises(mysql.connector.Error):          # both listings
        sql("INSERT INTO applications (student_id, internship_id, placement_id) VALUES ('S1', %s, %s)", (lid, lid))


def test_duplicate_application_rejected_by_unique_keys(make, sql):
    make.student("S1"); co = make.company(); lid = make.listing(co)
    make.apply("S1", lid)
    with pytest.raises(mysql.connector.IntegrityError):
        make.apply("S1", lid)


def test_email_uniqueness_across_students(make):
    make.student("S1", email="same@example.test")
    with pytest.raises(mysql.connector.IntegrityError):
        make.student("S2", email="same@example.test")


def test_foreign_keys_block_orphans_and_cascade_cleans_up(make, sql):
    with pytest.raises(mysql.connector.IntegrityError):  # application for a student that doesn't exist
        sql("INSERT INTO applications (student_id, placement_id) VALUES ('GHOST', 1)")
    make.student("S1"); co = make.company(); lid = make.listing(co); make.apply("S1", lid)
    sql("DELETE FROM placement_listings WHERE placement_id=%s", (lid,))
    assert sql("SELECT COUNT(*) n FROM applications")[0]["n"] == 0   # deleting a listing removes its applications
    sql("DELETE FROM students WHERE student_id='S1'")
    assert sql("SELECT COUNT(*) n FROM students")[0]["n"] == 0


def test_recruiter_must_belong_to_a_company(make):
    with pytest.raises(mysql.connector.IntegrityError):
        make.recruiter(9999)
